// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — AI PAYMENT VERIFICATION AGENT
// Autonomous background process for auditing final invoice payment proof.
// Runs continuously, parses screenshots with Gemini Vision API, and updates DB.
// =========================================================================

const SUPABASE_URL = "https://qvnjjvbmethdvmlzeoow.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JHxEhYkcEdn6zNs3cEIp3g_p69o5_4k";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is not defined.");
  process.exit(1);
}

console.log("=========================================================================");
console.log("Starting Chhotu AI Payment Verification Agent...");
console.log("Supabase URL:", SUPABASE_URL);
console.log("Polling Interval: 10 seconds");
console.log("=========================================================================");

// Main daemon loop
setInterval(pollAndProcessPayments, 10000);
// Run once immediately on startup
pollAndProcessPayments();

async function pollAndProcessPayments() {
  try {
    // 1. Fetch bookings awaiting payment verification
    const bookings = await fetchFromSupabase("/rest/v1/bookings?status=eq.payment_submitted&final_payment_status=eq.submitted");
    if (!bookings || bookings.length === 0) {
      return;
    }

    console.log(`[AI Agent] Found ${bookings.length} payment submissions to process.`);

    for (const booking of bookings) {
      await processSingleBookingPayment(booking);
    }
  } catch (err) {
    console.error("[AI Agent] Error in polling cycle:", err.message || err);
  }
}

async function processSingleBookingPayment(booking) {
  console.log(`[AI Agent] Processing booking ID: ${booking.id} (${booking.name})`);
  const logPrefix = `[Booking ${booking.id.substring(0, 8)}]`;

  try {
    // 2. Fetch invoice to match expected total amount
    const invoices = await fetchFromSupabase(`/rest/v1/invoices?booking_id=eq.${booking.id}`);
    if (!invoices || invoices.length === 0) {
      throw new Error("No invoice generated for this booking.");
    }
    const invoice = invoices[0];
    const expectedAmount = parseFloat(invoice.total_amount);

    console.log(`${logPrefix} Expected invoice total: Rs. ${expectedAmount}`);

    // 3. Duplicate checks (UTR/UPI Ref or Base64 Image hash)
    const base64Image = booking.final_payment_screenshot_url || "";
    const customerUtr = booking.final_payment_upi_reference || "";

    if (customerUtr) {
      // Check if UTR already verified on another booking
      const duplicateUtrs = await fetchFromSupabase(
        `/rest/v1/bookings?final_payment_status=eq.verified&id=neq.${booking.id}&or=(final_payment_upi_reference.eq.${encodeURIComponent(customerUtr)},final_payment_upi_extracted.eq.${encodeURIComponent(customerUtr)})`
      );

      if (duplicateUtrs && duplicateUtrs.length > 0) {
        console.log(`${logPrefix} Duplicate UTR reference detected! Rejecting payment.`);
        await handleDecision(booking.id, "completed_awaiting_payment", "rejected", "Duplicate transaction reference detected (suspicious activity).", customerUtr, 0, null, "duplicate", `Duplicate UTR match found on booking ${duplicateUtrs[0].id}`);
        return;
      }
    }

    // Check if Base64 screenshot data matches another verified booking's screenshot
    if (base64Image && base64Image.length > 100) {
      // PostgREST body matching is cleaner for large base64 strings
      const duplicateScreenshots = await fetchFromSupabase(`/rest/v1/bookings?final_payment_status=eq.verified&id=neq.${booking.id}&final_payment_screenshot_url=eq.${encodeURIComponent(base64Image)}`);
      
      if (duplicateScreenshots && duplicateScreenshots.length > 0) {
        console.log(`${logPrefix} Duplicate screenshot image detected! Rejecting payment.`);
        await handleDecision(booking.id, "completed_awaiting_payment", "rejected", "Duplicate screenshot proof detected (suspicious activity).", null, 0, null, "duplicate", `Duplicate screenshot match found on booking ${duplicateScreenshots[0].id}`);
        return;
      }
    }

    // 4. Send screenshot to Gemini Vision API for extraction
    console.log(`${logPrefix} Sending screenshot to Gemini Vision API...`);
    const cleanBase64 = base64Image.split(",")[1] || base64Image;
    const mimeType = base64Image.split(";")[0].split(":")[1] || "image/png";

    if (!cleanBase64) {
      throw new Error("Invalid screenshot base64 image data.");
    }

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: "Analyze this transaction screenshot and extract the details as a JSON object with these keys: amount (numeric, extract the total money paid, excluding commas or currency symbols), utr (string, the UPI transaction ID, bank reference number, or transaction ID if visible, else null), status (string, either 'success' if transaction is successful or completed, or 'failed' if rejected/pending), and date (string, the date/time of transaction, else null). Return ONLY raw JSON, do not wrap in markdown ```json blocks."
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} (${errText})`);
    }

    const geminiData = await response.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini Vision API.");
    }

    console.log(`${logPrefix} Gemini Vision raw text response:`, responseText.trim());

    // Clean Markdown tags
    const cleanJsonText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    let result = null;
    try {
      result = JSON.parse(cleanJsonText);
    } catch (e) {
      console.warn(`${logPrefix} Failed to parse Gemini JSON output. Trying regex extract...`);
      // Fallback parse amount
      const amtMatch = responseText.match(/"amount"\s*:\s*([\d.]+)/);
      const utrMatch = responseText.match(/"utr"\s*:\s*"([^"]+)"/);
      const statusMatch = responseText.match(/"status"\s*:\s*"([^"]+)"/);
      if (amtMatch) {
        result = {
          amount: parseFloat(amtMatch[1]),
          utr: utrMatch ? utrMatch[1] : null,
          status: statusMatch ? statusMatch[1] : "failed",
          date: null
        };
      }
    }

    if (!result || isNaN(result.amount)) {
      console.log(`${logPrefix} Unreadable screenshot contents. Flagging for manual admin review.`);
      await handleDecision(
        booking.id, 
        "payment_submitted", 
        "submitted", 
        "AI could not read the screenshot details clearly. Flagged for manual review.", 
        null, 
        0, 
        null, 
        "manual_review", 
        `Unparseable AI output: ${responseText}`
      );
      return;
    }

    const extractedAmount = parseFloat(result.amount);
    const extractedUtr = result.utr || null;
    const extractedStatus = result.status || "failed";
    const extractedDate = result.date || null;

    console.log(`${logPrefix} Extracted Amount: Rs. ${extractedAmount}, Extracted UTR: ${extractedUtr}, Extracted Status: ${extractedStatus}`);

    // 5. Decision Rules
    if (extractedStatus === "success" && Math.abs(extractedAmount - expectedAmount) < 0.01) {
      // Match successful! Promote booking status to payment_verified
      console.log(`${logPrefix} Amount matches exactly. Verifying payment!`);
      await handleDecision(
        booking.id,
        "payment_verified",
        "verified",
        null,
        extractedUtr,
        extractedAmount,
        extractedDate,
        "verified",
        `AI Auto-Verified: Amount Rs. ${extractedAmount} matches expected invoice.`
      );
    } else {
      // Amount mismatch or transaction failed
      let rejectReason = `Amount mismatch. Paid Rs. ${extractedAmount}, expected Rs. ${expectedAmount}.`;
      if (extractedStatus !== "success") {
        rejectReason = `Transaction failed or pending on screenshot.`;
      }
      console.log(`${logPrefix} Verification rejected: ${rejectReason}`);
      await handleDecision(
        booking.id,
        "completed_awaiting_payment",
        "rejected",
        rejectReason,
        extractedUtr,
        extractedAmount,
        extractedDate,
        "rejected",
        `AI Auto-Rejected: ${rejectReason}`
      );
    }

  } catch (err) {
    console.error(`${logPrefix} Error processing payment:`, err.message || err);
    // Flag for manual review on unexpected errors to keep system running
    await handleDecision(
      booking.id, 
      "payment_submitted", 
      "submitted", 
      `Internal agent error: ${err.message || err}. Flagged for manual review.`, 
      null, 
      0, 
      null, 
      "manual_review", 
      `Internal Error: ${err.message || err}`
    );
  }
}

async function handleDecision(bookingId, status, finalStatus, rejectionReason, utrExtracted, amountExtracted, dateExtracted, decision, details) {
  try {
    // 1. Update booking and invoice tables using secure definer RPC function
    await fetchFromSupabase("/rest/v1/rpc/update_booking_payment_by_agent", {
      method: "POST",
      body: JSON.stringify({
        p_booking_id: bookingId,
        p_status: status,
        p_final_status: finalStatus,
        p_rejection_reason: rejectionReason,
        p_upi_extracted: utrExtracted,
        p_amount_extracted: amountExtracted || 0,
        p_date_extracted: dateExtracted ? String(dateExtracted) : null
      })
    });

    // 2. Log trace inside payment_audit_logs table
    await fetchFromSupabase("/rest/v1/payment_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        booking_id: bookingId,
        extracted_amount: amountExtracted || 0,
        extracted_upi_ref: utrExtracted,
        extracted_status: decision,
        decision: decision,
        log_details: details
      })
    });

    console.log(`[AI Agent] Successfully recorded decision [${decision.toUpperCase()}] for Booking ID: ${bookingId}`);
  } catch (err) {
    console.error(`[AI Agent] Failed to record decision in database:`, err.message || err);
  }
}

// Supabase HTTP request helper
async function fetchFromSupabase(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const defaultHeaders = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  const fetchOptions = {
    method: options.method || "GET",
    headers: { ...defaultHeaders, ...options.headers }
  };

  if (options.body) {
    fetchOptions.body = options.body;
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
  }

  if (response.status === 204) return null; // No content response

  return await response.json();
}
