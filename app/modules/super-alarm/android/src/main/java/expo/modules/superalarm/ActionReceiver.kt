package expo.modules.superalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/** Done and Snooze buttons on the notification and on the full-screen alarm. */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    handle(ctx, intent.action ?: return, id)
  }

  companion object {
    fun handle(ctx: Context, action: String, id: String) {
      NotificationManagerCompat.from(ctx).cancel(id.hashCode())
      AlarmActivity.closeIfShowing(id)
      val a = AlarmStore.get(ctx, id) ?: return
      when (action) {
        AlarmScheduler.ACTION_DONE -> {
          AlarmStore.pushEvent(ctx, "done", id)
          AlarmScheduler.finishOccurrence(ctx, a, done = true)
        }
        AlarmScheduler.ACTION_SNOOZE -> {
          AlarmStore.pushEvent(ctx, "snooze", id)
          AlarmScheduler.arm(ctx, a.copy(timeMs = System.currentTimeMillis() + AlarmScheduler.SNOOZE_MS, stage = 0))
        }
      }
    }
  }
}
