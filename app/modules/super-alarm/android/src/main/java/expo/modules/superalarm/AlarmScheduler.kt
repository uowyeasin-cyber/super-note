package expo.modules.superalarm

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Calendar

object AlarmScheduler {
  const val EXTRA_ID = "super_alarm_id"
  const val ACTION_FIRE = "expo.modules.superalarm.FIRE"
  const val ACTION_DONE = "expo.modules.superalarm.DONE"
  const val ACTION_SNOOZE = "expo.modules.superalarm.SNOOZE"
  const val ESCALATE_AFTER_MS = 5 * 60 * 1000L
  const val SNOOZE_MS = 10 * 60 * 1000L

  const val CH_NORMAL = "sn_normal"
  const val CH_URGENT = "sn_urgent"
  const val CH_CRITICAL = "sn_critical"

  private fun req(id: String, salt: Int) = id.hashCode() * 31 + salt

  private fun fireIntent(ctx: Context, id: String): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(ctx, req(id, 0), i,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun canExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
  }

  /** Saves the alarm and arms it. The same id always replaces the old one, so nothing rings twice. */
  fun arm(ctx: Context, a: Alarm) {
    AlarmStore.put(ctx, a)
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = fireIntent(ctx, a.id)
    am.cancel(pi)
    val at = maxOf(a.timeMs, System.currentTimeMillis() + 1000)
    if (canExact(ctx)) {
      val show = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
        PendingIntent.getActivity(ctx, req(a.id, 9), it, PendingIntent.FLAG_IMMUTABLE)
      }
      am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(fireIntent(ctx, id))
    NotificationManagerCompat.from(ctx).cancel(id.hashCode())
    AlarmStore.remove(ctx, id)
  }

  /** Next time a repeating alarm should ring, strictly after now. */
  fun nextRepeat(a: Alarm, now: Long = System.currentTimeMillis()): Long? {
    val step = when (a.repeat) { "daily" -> Calendar.DAY_OF_YEAR to 1; "weekly" -> Calendar.WEEK_OF_YEAR to 1; else -> return null }
    val c = Calendar.getInstance().apply { timeInMillis = a.baseMs }
    while (c.timeInMillis <= now) c.add(step.first, step.second)
    return c.timeInMillis
  }

  /** This occurrence is over: arm the next repeat, or keep the alarm only until Done. */
  fun finishOccurrence(ctx: Context, a: Alarm, done: Boolean) {
    val next = nextRepeat(a)
    when {
      next != null -> arm(ctx, a.copy(timeMs = next, baseMs = next, stage = 0))
      done -> { cancel(ctx, a.id); return }
      else -> {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(fireIntent(ctx, a.id))
        AlarmStore.put(ctx, a.copy(stage = -1))
      }
    }
  }

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val alarmAttrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
    nm.createNotificationChannel(NotificationChannel(CH_NORMAL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT))
    nm.createNotificationChannel(NotificationChannel(CH_URGENT, "Urgent reminders (alarm sound)", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), alarmAttrs)
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 600, 400, 600)
      setBypassDnd(true)
    })
    nm.createNotificationChannel(NotificationChannel(CH_CRITICAL, "Must-not-miss (full screen)", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(null, null)
      setBypassDnd(true)
    })
  }

  private fun action(ctx: Context, act: String, id: String, salt: Int): PendingIntent {
    val i = Intent(ctx, ActionReceiver::class.java).setAction(act).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(ctx, req(id, salt), i,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Shows the ring for this alarm at its current stage. */
  fun ring(ctx: Context, a: Alarm) {
    ensureChannels(ctx)
    val level = a.effectiveLevel()
    val channel = when (level) { "critical" -> CH_CRITICAL; "urgent" -> CH_URGENT; else -> CH_NORMAL }
    val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
      PendingIntent.getActivity(ctx, req(a.id, 3), it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val b = NotificationCompat.Builder(ctx, channel)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(a.title)
      .setContentText(a.body.ifBlank { null })
      .setStyle(NotificationCompat.BigTextStyle().bigText(a.body))
      .setCategory(if (level == "normal") NotificationCompat.CATEGORY_REMINDER else NotificationCompat.CATEGORY_ALARM)
      .setPriority(if (level == "normal") NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_MAX)
      .setAutoCancel(level == "normal")
      .setOngoing(level != "normal")
      .setContentIntent(open)
      .addAction(0, "Done", action(ctx, ACTION_DONE, a.id, 1))
      .addAction(0, "Snooze 10 min", action(ctx, ACTION_SNOOZE, a.id, 2))
    if (level == "critical") {
      val full = Intent(ctx, AlarmActivity::class.java)
        .putExtra(EXTRA_ID, a.id)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
      val fpi = PendingIntent.getActivity(ctx, req(a.id, 4), full,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      b.setFullScreenIntent(fpi, true)
    }
    val n = b.build()
    if (level == "urgent") n.flags = n.flags or Notification.FLAG_INSISTENT
    try {
      NotificationManagerCompat.from(ctx).notify(a.id.hashCode(), n)
    } catch (_: SecurityException) {
      // Notifications are off; the app shows a banner asking to allow them.
    }
  }
}
