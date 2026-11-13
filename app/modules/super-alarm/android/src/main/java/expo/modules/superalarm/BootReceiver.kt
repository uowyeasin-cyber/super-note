package expo.modules.superalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Android forgets alarms on reboot, update or clock change. Re-arm every pending one from storage. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val now = System.currentTimeMillis()
    for (a in AlarmStore.all(ctx)) {
      if (a.stage < 0) continue
      if (a.timeMs >= now) {
        AlarmScheduler.arm(ctx, a)
      } else {
        val next = AlarmScheduler.nextRepeat(a, now)
        // A one-time alarm missed while the phone was off rings right away, once.
        AlarmScheduler.arm(ctx, if (next != null && now - a.timeMs > 60 * 60 * 1000L) a.copy(timeMs = next, baseMs = next, stage = 0) else a)
      }
    }
  }
}
