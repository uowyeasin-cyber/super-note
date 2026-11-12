package expo.modules.superalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fires when an alarm is due: rings it, then arms the next escalation step or the next repeat. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val a = AlarmStore.get(ctx, id) ?: return
    if (a.stage < 0) return
    AlarmScheduler.ring(ctx, a)
    AlarmStore.pushEvent(ctx, "fired", id)
    if (a.escalate && a.effectiveLevel() != "critical") {
      // Not done yet? Ring louder in 5 minutes: notification -> alarm -> call-style screen.
      AlarmScheduler.arm(ctx, a.copy(timeMs = System.currentTimeMillis() + AlarmScheduler.ESCALATE_AFTER_MS, stage = a.stage + 1))
    } else {
      AlarmScheduler.finishOccurrence(ctx, a, done = false)
    }
  }
}
