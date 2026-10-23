package expo.modules.shieldnative

/** Package lists for India. Extend as needed; categories only, never content. */
object Catalog {
  val REMOTE_ACCESS = setOf(
    "com.anydesk.anydeskandroid",
    "com.teamviewer.quicksupport.market",
    "com.teamviewer.teamviewer.market.mobile",
    "com.rustdesk.rustdesk",
    "com.sand.airdroid",
    "com.sand.airdroidbiz",
    "com.splashtop.remote.pad.v2",
    "com.microsoft.rdc.androidx",
    "com.realvnc.viewer.android",
    "com.google.chromeremotedesktop",
  )
  val UPI = setOf(
    "com.google.android.apps.nbu.paisa.user", // Google Pay
    "com.phonepe.app",
    "net.one97.paytm",
    "in.org.npci.upiapp", // BHIM
    "in.amazon.mShop.android.shopping", // Amazon Pay lives inside the Amazon app — only counted during unknown calls
    "com.dreamplug.androidapp", // CRED
    "com.mobikwik_new",
    "com.freecharge.android",
  )
  val BANK = setOf(
    "com.sbi.lotusintouch", // YONO SBI
    "com.sbi.SBIFreedomPlus",
    "com.csam.icici.bank.imobile",
    "com.snapwork.hdfc",
    "com.hdfcbank.payzapp",
    "com.axis.mobile",
    "com.msf.kbank.mobile", // Kotak
    "com.bankofbaroda.mconnect",
    "com.pnb.pnbone",
    "com.canarabank.mobility",
    "com.unionbank.ecommerce.mobile.android",
    "com.idbibank.abhay_card",
    "com.fedmobile",
    "com.indusind.mobile.indie",
    "com.yesbank",
  )
  val DELIVERY = setOf(
    "in.amazon.mShop.android.shopping",
    "com.flipkart.android",
    "in.swiggy.android",
    "com.application.zomato",
    "com.grofers.customerapp", // Blinkit
    "com.zeptoconsumerapp",
    "com.myntra.android",
    "com.bigbasket.mobileapp",
    "com.meesho.supply",
  )
  val SMS_APPS = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.miui.securitycenter",
    "com.truecaller",
  )
  val WHATSAPP = setOf("com.whatsapp", "com.whatsapp.w4b")

  val DELIVERY_TEXT = Regex("out for delivery|on (the|its) way|arriving|delivery (partner|executive|agent)|rider|reaching you|order is near", RegexOption.IGNORE_CASE)
  val OTP_TEXT = Regex("\\b(otp|one[- ]time password|verification code)\\b.*\\b\\d{4,8}\\b|\\b\\d{4,8}\\b.*\\b(otp|one[- ]time password)\\b", RegexOption.IGNORE_CASE)
  /** An ongoing-call notification whose title is a number (not a saved contact name). */
  val NUMBER_TITLE = Regex("^[+\\d][\\d\\s()\\-]{6,}$")

  fun categoryOf(pkg: String): Action? = when (pkg) {
    in REMOTE_ACCESS -> Action.REMOTE_OPEN
    in BANK -> Action.BANK_OPEN
    in UPI -> Action.UPI_OPEN
    else -> null
  }
}
