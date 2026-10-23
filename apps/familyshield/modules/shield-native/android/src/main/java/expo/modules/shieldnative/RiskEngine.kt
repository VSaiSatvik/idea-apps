package expo.modules.shieldnative

/**
 * Kotlin port of src/lib/engine.ts (the tested TypeScript engine).
 * KEEP THE WEIGHTS IN SYNC with WEIGHTS in engine.ts — the TS version has the tests
 * and the population evaluation; this one runs inside the background service.
 */
object Weights {
  const val REMOTE_INSTALL = 80
  const val REMOTE_OPEN = 80
  const val BANK_OPEN = 35
  const val UPI_OPEN = 30
  const val OTP_SMS = 35
  const val DURING_UNKNOWN_CALL = 30
  const val ELAPSED_OVER_3 = 20
  const val ELAPSED_OVER_15 = 15
  const val INTERNATIONAL = 10
  const val WHATSAPP_UNKNOWN = 10
  const val AFTER_SHORT_CALL_ONLY = -40
  const val LIKELY_RIDER = -35
  const val DELIVERY_WINDOW_MIN = 90
  const val RIDER_MAX_MIN = 5
  const val BANNER_AT = 50
  const val PAUSE_AT = 80
  const val COOLDOWN_MIN = 10
}

enum class Action(val label: String, val weight: Int) {
  REMOTE_INSTALL("remote install", Weights.REMOTE_INSTALL),
  REMOTE_OPEN("remote open", Weights.REMOTE_OPEN),
  BANK_OPEN("bank open", Weights.BANK_OPEN),
  UPI_OPEN("upi open", Weights.UPI_OPEN),
  OTP_SMS("otp sms", Weights.OTP_SMS),
}

data class CallState(
  val key: String,
  val startMs: Long,
  var endMs: Long? = null,
  val whatsapp: Boolean,
  val international: Boolean,
  val number: String?,
  val inDeliveryWindow: Boolean,
)

data class Decision(val atMs: Long, val tier: String, val score: Int, val reasons: List<String>, val number: String?, val medium: String)

class RiskEngine {
  private val calls = LinkedHashMap<String, CallState>()
  private var deliveryUntilMs = Long.MIN_VALUE
  private var lastPauseMs = Long.MIN_VALUE / 2
  private var lastBannerMs = Long.MIN_VALUE / 2

  private fun min(ms: Long) = ms / 60000.0

  fun deliveryNotice(nowMs: Long) {
    deliveryUntilMs = maxOf(deliveryUntilMs, nowMs + Weights.DELIVERY_WINDOW_MIN * 60000L)
  }

  fun callStarted(key: String, nowMs: Long, whatsapp: Boolean, number: String?, international: Boolean) {
    if (calls.containsKey(key)) return
    calls[key] = CallState(key, nowMs, null, whatsapp, international, number, !whatsapp && nowMs <= deliveryUntilMs)
    // forget calls that ended more than an hour ago
    val cutoff = nowMs - 60 * 60000L
    calls.entries.removeAll { (it.value.endMs ?: Long.MAX_VALUE) < cutoff }
  }

  fun callEnded(key: String, nowMs: Long) {
    calls[key]?.let { if (it.endMs == null) it.endMs = nowMs }
  }

  /** True while an unknown call is going on or ended in the last 30 minutes (the only time app launches are checked). */
  fun watching(nowMs: Long): Boolean = calls.values.any { it.endMs == null || nowMs - it.endMs!! <= 30 * 60000L }

  fun action(a: Action, nowMs: Long): Decision? {
    val recent = calls.values.filter { it.startMs <= nowMs && (it.endMs == null || nowMs - it.endMs!! <= 30 * 60000L) }
    if (recent.isEmpty()) return null
    val ongoing = recent.filter { it.endMs == null || it.endMs!! >= nowMs }
    val c = (if (ongoing.isNotEmpty()) ongoing else recent).maxByOrNull { it.startMs }!!
    val reasons = mutableListOf(a.label)
    var score = a.weight
    val isOngoing = c.endMs == null || c.endMs!! >= nowMs
    val elapsed = min(nowMs - c.startMs)
    if (isOngoing) { score += Weights.DURING_UNKNOWN_CALL; reasons += "during a call from an unknown number" }
    if (isOngoing && elapsed > 3) { score += Weights.ELAPSED_OVER_3; reasons += "call has lasted ${elapsed.toInt()} min" }
    if (isOngoing && elapsed > 15) score += Weights.ELAPSED_OVER_15
    if (c.international) { score += Weights.INTERNATIONAL; reasons += "international number" }
    if (c.whatsapp) { score += Weights.WHATSAPP_UNKNOWN; reasons += "WhatsApp call from an unsaved number" }
    if (!isOngoing && c.endMs != null && min(c.endMs!! - c.startMs) < 2) { score += Weights.AFTER_SHORT_CALL_ONLY; reasons += "after a short call (delivery pattern)" }
    val length = min((c.endMs ?: nowMs) - c.startMs)
    if (c.inDeliveryWindow && length <= Weights.RIDER_MAX_MIN && a != Action.REMOTE_INSTALL && a != Action.REMOTE_OPEN) {
      score += Weights.LIKELY_RIDER; reasons += "call came while an order was out for delivery (likely the rider)"
    }
    var tier = if (score >= Weights.PAUSE_AT) "pause" else if (score >= Weights.BANNER_AT) "banner" else "none"
    if (tier == "pause" && min(nowMs - lastPauseMs) < Weights.COOLDOWN_MIN) tier = "none"
    if (tier == "banner" && min(nowMs - lastBannerMs) < Weights.COOLDOWN_MIN) tier = "none"
    if (tier == "pause") lastPauseMs = nowMs
    if (tier == "banner") lastBannerMs = nowMs
    return if (tier == "none") null else Decision(nowMs, tier, score, reasons, c.number, if (c.whatsapp) "WhatsApp" else "Call")
  }
}
