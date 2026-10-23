package expo.modules.shieldnative

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShieldNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ShieldNative")

    Function("getStatus") {
      mapOf(
        "notificationAccess" to hasNotificationAccess(),
        "usageAccess" to hasUsageAccess(),
        "overlay" to Settings.canDrawOverlays(context),
        "enabled" to ShieldStore.enabled(context),
        "sdk" to Build.VERSION.SDK_INT,
      )
    }

    Function("openSettings") { which: String ->
      val intent = when (which) {
        "notification" -> Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        "usage" -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("configure") { enabled: Boolean?, lang: String?, childName: String?, homeCode: String? ->
      ShieldStore.configure(context, enabled, lang, childName, homeCode)
    }

    Function("recentDecisions") {
      ShieldStore.decisions(context)
    }
  }

  private fun hasNotificationAccess(): Boolean {
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    val me = ComponentName(context, ShieldListenerService::class.java).flattenToString()
    return flat.split(":").any { it == me }
  }

  private fun hasUsageAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= 29)
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
