// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — CLOUDINARY DIRECT UPLOAD HELPER
// Uploads photos and payment screenshots directly to Cloudinary (Free Tier)
// Storing clean CDN URLs in Supabase, keeping DB storage usage at near 0%.
// =========================================================================

const CLOUDINARY_CONFIG = {
  cloudName: "kgca3vma",
  uploadPreset: "Payment proof"
};

/**
 * Uploads a File, Blob, or base64 data URI to Cloudinary via Unsigned Preset
 * @param {File|Blob|string} fileInput - The file or base64 string
 * @param {string} [folder="chhotu_motorcycle"] - Optional folder name
 * @returns {Promise<string>} Secure CDN URL of the uploaded image
 */
async function uploadToCloudinary(fileInput, folder = "chhotu_motorcycle") {
  if (!fileInput) {
    throw new Error("No file provided for upload.");
  }

  const formData = new FormData();
  formData.append("file", fileInput);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (folder) {
    formData.append("folder", folder);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    console.error("Cloudinary upload failed:", data);
    throw new Error(data.error?.message || "Image upload failed. Please try again.");
  }

  return data.secure_url;
}

window.uploadToCloudinary = uploadToCloudinary;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
