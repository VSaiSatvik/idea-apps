package expo.modules.shieldnative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Settings and the last decisions, kept only on this phone. */
object ShieldStore {
  private const val PREFS = "family_shield"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun enabled(ctx: Context) = prefs(ctx).getBoolean("enabled", false)
  fun lang(ctx: Context) = prefs(ctx).getString("lang", "hi") ?: "hi"
  fun childName(ctx: Context) = prefs(ctx).getString("childName", "") ?: ""
  fun homeCode(ctx: Context) = prefs(ctx).getString("homeCode", "+91") ?: "+91"

  fun configure(ctx: Context, enabled: Boolean?, lang: String?, childName: String?, homeCode: String?) {
    val e = prefs(ctx).edit()
    if (enabled != null) e.putBoolean("enabled", enabled)
    if (lang != null) e.putString("lang", lang)
    if (childName != null) e.putString("childName", childName)
    if (homeCode != null) e.putString("homeCode", homeCode)
    e.apply()
  }

  fun addDecision(ctx: Context, d: Decision) {
    val arr = JSONArray(prefs(ctx).getString("decisions", "[]"))
    val o = JSONObject()
      .put("at", d.atMs)
      .put("tier", d.tier)
      .put("score", d.score)
      .put("reasons", JSONArray(d.reasons))
      .put("number", d.number ?: JSONObject.NULL)
      .put("medium", d.medium)
    val out = JSONArray().put(o)
    for (i in 0 until minOf(arr.length(), 19)) out.put(arr.get(i))
    prefs(ctx).edit().putString("decisions", out.toString()).apply()
  }

  fun decisions(ctx: Context): String = prefs(ctx).getString("decisions", "[]") ?: "[]"
}
