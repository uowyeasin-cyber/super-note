package expo.modules.superalarm

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Keeps the last crash in a small file so the app can show it on the next start
 * and the owner can send it to the developer. Chains to the system handler, so
 * crashes still behave normally.
 */
object CrashLog {
  @Volatile private var installed = false

  private fun file(ctx: Context) = File(ctx.applicationContext.filesDir, "last-crash.txt")

  fun install(ctx: Context) {
    if (installed) return
    installed = true
    val app = ctx.applicationContext
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      runCatching {
        val sw = StringWriter()
        error.printStackTrace(PrintWriter(sw))
        save(app, "Native crash on thread ${thread.name}\n$sw")
      }
      previous?.uncaughtException(thread, error)
    }
  }

  fun save(ctx: Context, text: String) {
    val head = "Easy Life · Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) · ${Build.MANUFACTURER} ${Build.MODEL}\n"
    runCatching { file(ctx).writeText(head + text.take(12000)) }
  }

  fun take(ctx: Context): String {
    val f = file(ctx)
    if (!f.exists()) return ""
    val text = runCatching { f.readText() }.getOrDefault("")
    runCatching { f.delete() }
    return text
  }
}
