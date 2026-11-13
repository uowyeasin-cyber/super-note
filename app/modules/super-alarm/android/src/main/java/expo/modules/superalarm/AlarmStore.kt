package expo.modules.superalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** One reminder as the native engine keeps it. Times are epoch milliseconds. */
data class Alarm(
  val id: String,
  val timeMs: Long,
  val title: String,
  val body: String,
  val level: String,      // normal | urgent | critical
  val repeat: String,     // none | daily | weekly
  val escalate: Boolean,  // notification -> alarm -> call-style screen if not done
  val stage: Int = 0,     // 0 = first ring, 1 = alarm, 2 = call-style, -1 = rang, waiting for Done
  val baseMs: Long = timeMs // the planned time of this occurrence (repeats count from here)
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id).put("timeMs", timeMs).put("title", title).put("body", body)
    .put("level", level).put("repeat", repeat).put("escalate", escalate).put("stage", stage).put("baseMs", baseMs)

  /** Level actually used for this ring, after escalation. */
  fun effectiveLevel(): String = when {
    level == "critical" || stage >= 2 -> "critical"
    level == "urgent" || stage == 1 -> "urgent"
    else -> "normal"
  }

  companion object {
    fun fromJson(o: JSONObject) = Alarm(
      o.getString("id"), o.getLong("timeMs"), o.optString("title"), o.optString("body"),
      o.optString("level", "normal"), o.optString("repeat", "none"),
      o.optBoolean("escalate", false), o.optInt("stage", 0),
      o.optLong("baseMs", o.getLong("timeMs"))
    )
  }
}

/** Alarms live in SharedPreferences so they survive reboots and app kills without JS. */
object AlarmStore {
  private const val PREFS = "super_alarm_store"
  private const val EVENTS = "events"

  private fun prefs(ctx: Context) =
    ctx.createDeviceProtectedStorageContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(ctx: Context, a: Alarm) {
    prefs(ctx).edit().putString("a:" + a.id, a.toJson().toString()).apply()
  }

  fun get(ctx: Context, id: String): Alarm? =
    prefs(ctx).getString("a:$id", null)?.let { runCatching { Alarm.fromJson(JSONObject(it)) }.getOrNull() }

  fun remove(ctx: Context, id: String) {
    prefs(ctx).edit().remove("a:$id").apply()
  }

  fun all(ctx: Context): List<Alarm> = prefs(ctx).all.entries
    .filter { it.key.startsWith("a:") }
    .mapNotNull { e -> (e.value as? String)?.let { runCatching { Alarm.fromJson(JSONObject(it)) }.getOrNull() } }

  /** Done / snooze taps are queued here, then read once by JS to update the note database. */
  @Synchronized
  fun pushEvent(ctx: Context, type: String, id: String) {
    val p = prefs(ctx)
    val arr = runCatching { JSONArray(p.getString(EVENTS, "[]")) }.getOrDefault(JSONArray())
    arr.put(JSONObject().put("type", type).put("id", id).put("at", System.currentTimeMillis()))
    p.edit().putString(EVENTS, arr.toString()).apply()
  }

  @Synchronized
  fun takeEvents(ctx: Context): String {
    val p = prefs(ctx)
    val s = p.getString(EVENTS, "[]") ?: "[]"
    p.edit().putString(EVENTS, "[]").apply()
    return s
  }
}
