package expo.modules.superalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class SuperAlarmModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun open(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { ctx.startActivity(intent) }.onFailure {
      ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SuperAlarm")

    OnCreate { runCatching { AlarmScheduler.ensureChannels(ctx) } }

    Function("schedule") { id: String, timeMs: Double, title: String, body: String, level: String, repeat: String, escalate: Boolean ->
      val t = timeMs.toLong()
      AlarmScheduler.arm(ctx, Alarm(id, t, title, body, level, repeat, escalate, 0, t))
      true
    }

    Function("cancel") { id: String ->
      AlarmScheduler.cancel(ctx, id)
      AlarmActivity.closeIfShowing(id)
      true
    }

    Function("list") {
      JSONArray().also { arr -> AlarmStore.all(ctx).forEach { arr.put(it.toJson()) } }.toString()
    }

    Function("consumeEvents") { AlarmStore.takeEvents(ctx) }

    Function("canScheduleExact") { AlarmScheduler.canExact(ctx) }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.packageName)))
      }
    }

    Function("canUseFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
      } else true
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.packageName)))
      }
    }

    Function("notificationsEnabled") {
      (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled()
    }

    Function("openNotificationSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName))
      } else open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
    }

    Function("isIgnoringBatteryOptimizations") {
      (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(ctx.packageName)
    }

    Function("openBatterySettings") {
      open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    Function("testRing") { level: String ->
      val now = System.currentTimeMillis()
      AlarmScheduler.arm(ctx, Alarm("test-ring", now + 5000, "Test reminder", "This is how a $level reminder looks.", level, "none", false, 0, now + 5000))
      true
    }
  }
}
