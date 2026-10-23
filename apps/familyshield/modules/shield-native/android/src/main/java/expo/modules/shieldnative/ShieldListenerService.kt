package expo.modules.shieldnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Runs while the parent has granted "Notification access" to Family Shield.
 * It reads ONLY: ongoing-call notifications (to know a call with an unsaved number is in progress — phone or WhatsApp),
 * delivery-app updates ("out for delivery"), and SMS arrival (OTP text only when Android still shows it).
 * While an unknown call is active, or ended in the last 30 minutes, it checks which app is opened (Usage access).
 * Decisions stay on the phone. Nothing is recorded or uploaded.
 */
class ShieldListenerService : NotificationListenerService() {
  private val engine = RiskEngine()
  private val main = Handler(Looper.getMainLooper())
  private var lastPollMs = 0L
  private var polling = false
  private var installReceiver: BroadcastReceiver? = null

  private val poll = object : Runnable {
    override fun run() {
      val now = System.currentTimeMillis()
      if (!engine.watching(now)) { polling = false; return }
      checkForegroundApps(now)
      main.postDelayed(this, 2500)
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    ensureChannels()
    if (installReceiver == null) {
      installReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          val pkg = intent.data?.schemeSpecificPart ?: return
          if (pkg in Catalog.REMOTE_ACCESS) handle(engine.action(Action.REMOTE_INSTALL, System.currentTimeMillis()))
        }
      }
      val f = IntentFilter(Intent.ACTION_PACKAGE_ADDED).apply { addDataScheme("package") }
      if (Build.VERSION.SDK_INT >= 33) registerReceiver(installReceiver, f, Context.RECEIVER_EXPORTED)
      else registerReceiver(installReceiver, f)
    }
  }

  override fun onListenerDisconnected() {
    installReceiver?.let { runCatching { unregisterReceiver(it) } }
    installReceiver = null
    super.onListenerDisconnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!ShieldStore.enabled(this) || sbn.packageName == packageName) return
    val now = System.currentTimeMillis()
    val n = sbn.notification ?: return
    val title = n.extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: ""
    val text = n.extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

    // 1. calls (any dialer, WhatsApp): an ongoing CALL notification whose title is a number = unknown caller
    if (n.category == Notification.CATEGORY_CALL) {
      val unknown = Catalog.NUMBER_TITLE.matches(title)
      if (unknown) {
        val number = title.replace(Regex("[^+\\d]"), "")
        val home = ShieldStore.homeCode(this)
        val international = number.startsWith("+") && !number.startsWith(home)
        engine.callStarted(sbn.key, now, sbn.packageName in Catalog.WHATSAPP, number, international)
        startPolling()
      }
      return
    }
    // 2. delivery updates open the rider window
    if (sbn.packageName in Catalog.DELIVERY && Catalog.DELIVERY_TEXT.containsMatchIn("$title $text")) {
      engine.deliveryNotice(now)
      return
    }
    // 3. OTP text (only visible where Android doesn't redact it)
    if (sbn.packageName in Catalog.SMS_APPS && Catalog.OTP_TEXT.containsMatchIn(text)) {
      handle(engine.action(Action.OTP_SMS, now))
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    if (sbn.notification?.category == Notification.CATEGORY_CALL) engine.callEnded(sbn.key, System.currentTimeMillis())
  }

  private fun startPolling() {
    if (polling) return
    polling = true
    lastPollMs = System.currentTimeMillis() - 2000
    main.post(poll)
  }

  private fun checkForegroundApps(now: Long) {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
    val events = try { usm.queryEvents(lastPollMs, now) } catch (e: SecurityException) { return }
    lastPollMs = now
    val e = UsageEvents.Event()
    val resumed = if (Build.VERSION.SDK_INT >= 29) UsageEvents.Event.ACTIVITY_RESUMED else @Suppress("DEPRECATION") UsageEvents.Event.MOVE_TO_FOREGROUND
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      if (e.eventType != resumed) continue
      val a = Catalog.categoryOf(e.packageName ?: continue) ?: continue
      handle(engine.action(a, e.timeStamp))
    }
  }

  private fun handle(d: Decision?) {
    if (d == null) return
    ShieldStore.addDecision(this, d)
    Log.i("FamilyShield", "${d.tier} score=${d.score} ${d.reasons}")
    if (d.tier == "pause") showPause(d) else showBanner()
  }

  private fun pauseUri(d: Decision): Uri = Uri.parse("familyshield://pause").buildUpon()
    .appendQueryParameter("reasons", d.reasons.joinToString("|"))
    .appendQueryParameter("medium", d.medium)
    .apply { d.number?.let { appendQueryParameter("number", it) } }
    .build()

  private fun showPause(d: Decision) {
    val intent = Intent(Intent.ACTION_VIEW, pauseUri(d)).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    // Starting an activity from the background is allowed when "Display over other apps" is granted.
    if (Settings.canDrawOverlays(this)) runCatching { startActivity(intent) }
    val pi = PendingIntent.getActivity(this, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val hi = ShieldStore.lang(this) != "en"
    val child = ShieldStore.childName(this).ifBlank { if (hi) "परिवार" else "family" }
    notify(2, CHANNEL_PAUSE, if (hi) "रुकिए।" else "Stop.",
      if (hi) "कोई भी OTP बताने या पैसे भेजने से पहले $child से बात करें।" else "Talk to $child before you share any OTP or send any money.", pi, true)
  }

  private fun showBanner() {
    val hi = ShieldStore.lang(this) != "en"
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pi = launch?.let { PendingIntent.getActivity(this, 3, it, PendingIntent.FLAG_IMMUTABLE) }
    notify(3, CHANNEL_TIP, "Family Shield",
      if (hi) "याद रखें: बैंक कभी भी फोन पर OTP नहीं मांगता।" else "Remember: banks never ask for an OTP over the phone.", pi, false)
  }

  private fun notify(id: Int, channel: String, title: String, body: String, pi: PendingIntent?, urgent: Boolean) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else @Suppress("DEPRECATION") Notification.Builder(this)
    b.setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setCategory(if (urgent) Notification.CATEGORY_ALARM else Notification.CATEGORY_REMINDER)
    if (pi != null) b.setContentIntent(pi)
    runCatching { nm.notify(id, b.build()) }
  }

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.createNotificationChannel(NotificationChannel(CHANNEL_PAUSE, "Scam pause", NotificationManager.IMPORTANCE_HIGH))
    nm.createNotificationChannel(NotificationChannel(CHANNEL_TIP, "Safety tips", NotificationManager.IMPORTANCE_DEFAULT))
  }

  companion object {
    const val CHANNEL_PAUSE = "shield_pause"
    const val CHANNEL_TIP = "shield_tip"
  }
}
