package expo.modules.superalarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.text.DateFormat
import java.util.Date

/** Call-style full-screen alarm for must-not-miss reminders. Loops the alarm tone until Done or Snooze. */
class AlarmActivity : Activity() {
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private var alarmId: String? = null

  companion object {
    private const val AUTO_STOP_MS = 2 * 60 * 1000L
    private var current: WeakReference<AlarmActivity>? = null

    fun closeIfShowing(id: String) {
      val act = current?.get() ?: return
      if (act.alarmId == id) act.runOnUiThread { act.finish() }
    }
  }

  private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID)
    alarmId = id
    val a = id?.let { AlarmStore.get(this, it) }
    buildUi(a?.title ?: "Reminder", a?.body ?: "")
    startSound()
    handler.postDelayed({ finish() }, AUTO_STOP_MS)
  }

  private fun buildUi(title: String, body: String) {
    val accent = Color.parseColor("#6B9BFF")
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setBackgroundColor(Color.parseColor("#0B0F17"))
      setPadding(dp(28), dp(96), dp(28), dp(48))
    }
    fun text(s: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
      text = s; textSize = size; setTextColor(color); gravity = Gravity.CENTER
      if (bold) typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    root.addView(text("SUPER NOTE · REMINDER", 12f, Color.parseColor("#7C8799"), true))
    root.addView(text(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date()), 56f, Color.WHITE, true).apply { setPadding(0, dp(24), 0, dp(8)) })
    root.addView(text(title, 26f, Color.parseColor("#EEF1F6"), true).apply { setPadding(0, dp(16), 0, dp(8)) })
    if (body.isNotBlank()) root.addView(text(body, 16f, Color.parseColor("#B3BCCB")))
    root.addView(LinearLayout(this), LinearLayout.LayoutParams(1, 0, 1f))

    fun pill(label: String, bg: Int, fg: Int) = Button(this).apply {
      text = label; isAllCaps = false; textSize = 17f; setTextColor(fg)
      background = GradientDrawable().apply { cornerRadius = dp(32).toFloat(); setColor(bg) }
    }
    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val lp = LinearLayout.LayoutParams(0, dp(64), 1f).apply { setMargins(dp(8), 0, dp(8), 0) }
    row.addView(pill("Snooze 10 min", Color.parseColor("#1B2230"), Color.parseColor("#EEF1F6")).apply {
      setOnClickListener { act(AlarmScheduler.ACTION_SNOOZE) }
    }, lp)
    row.addView(pill("Done", accent, Color.parseColor("#0B0F17")).apply {
      setOnClickListener { act(AlarmScheduler.ACTION_DONE) }
    }, lp)
    root.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    setContentView(root)
  }

  private fun act(action: String) {
    val id = alarmId
    stopSound()
    if (id != null) ActionReceiver.handle(this, action, id)
    finish()
  }

  private fun startSound() {
    runCatching {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(this@AlarmActivity, uri)
        isLooping = true
        prepare()
        start()
      }
    }
    runCatching {
      @Suppress("DEPRECATION")
      vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      val pattern = longArrayOf(0, 800, 600)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
      else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0)
    }
  }

  private fun stopSound() {
    runCatching { player?.stop(); player?.release() }
    player = null
    runCatching { vibrator?.cancel() }
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopSound()
    if (current?.get() === this) current = null
    super.onDestroy()
  }
}
