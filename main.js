const supabaseUrl = "https://qugaycqmtlsxcqtjbaer.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z2F5Y3FtdGxzeGNxdGpiYWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzAxNjgsImV4cCI6MjA5MzIwNjE2OH0.5I_8tSjfPRexp3ymBuj9gN-LlzHY4aoe37ScnbK4nSU";

const client = supabase.createClient(supabaseUrl, supabaseKey);

// ================= UTILS =================
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✓' : '⚠'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================= LOAD PRODUCTS =================
async function loadProducts() {
  const { data, error } = await client
    .from("products")
    .select("*")
    .order('id', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("products");
  if (!container) return;

  const isAdminPage = document.getElementById("adminPanel") !== null;
  container.innerHTML = "";

  const displayData = isAdminPage ? data : data.filter(p => !p.category || p.category === 'featured');

  if (!displayData || displayData.length === 0) {
    container.innerHTML = "<p style='color: white; text-align: center; width: 100%;'>No products found</p>";
    return;
  }

  displayData.forEach(product => {
    let adminButtons = '';
    const catLabel = product.category ? `<span style="font-size:0.75rem; color:rgba(255,255,255,0.5); text-transform:uppercase;">${product.category}</span>` : '';
    
    if (isAdminPage) {
      adminButtons = `
      <div class="card-actions">
        <button onclick="editProduct(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.price}, '${product.category || 'featured'}', '${product.image}')">
          Edit
        </button>
        <button onclick="deleteProduct(${product.id}, '${product.image}')">
          Delete
        </button>
      </div>`;
    }

    container.innerHTML += `
    <div class="card" id="product-${product.id}">
      <img src="${product.image}" alt="${product.name}" style="width:100%; height:300px; object-fit:cover;" />
      ${isAdminPage ? catLabel : ''}
      <h3>${product.name}</h3>
      <p>₹${product.price}</p>
      ${adminButtons}
    </div>
  `;
  });

  if (!isAdminPage) {
    initCarousel();
  }
}

function initCarousel() {
  const track = document.getElementById("products");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  
  if (!track || !prevBtn || !nextBtn) return;
  
  const scrollAmount = track.children.length > 0 ? track.children[0].offsetWidth + 40 : 390;
  
  nextBtn.onclick = () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
      track.scrollTo({ left: 0, behavior: 'smooth' }); // Loop back to start
    } else {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  
  prevBtn.onclick = () => {
    if (track.scrollLeft <= 0) {
      track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' }); // Loop to end
    } else {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };
}

// ================= ADD PRODUCT =================
async function addProduct() {
  const { data: userData } = await client.auth.getUser();

  if (!userData.user) {
    alert("Not logged in");
    return;
  }

  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const category = document.getElementById("category").value;
  const fileInput = document.getElementById("image");
  const file = fileInput.files[0];

  if (!name || !price || !file) {
    showToast("Please fill all fields and select an image", "error");
    return;
  }

  document.getElementById("loading").style.display = 'flex';
  document.getElementById("loading").innerText = "Uploading Product...";

  const fileName = Date.now() + "_" + file.name;

  const { data, error: uploadError } = await client.storage
    .from("products")
    .upload(fileName, file);

  if (uploadError) {
    console.error("UPLOAD ERROR:", uploadError);
    showToast("Image upload failed", "error");
    document.getElementById("loading").style.display = 'none';
    return;
  }

  const imageUrl = `${supabaseUrl}/storage/v1/object/public/products/${fileName}`;

  const { error: insertError } = await client.from("products").insert([{ name, price, image: imageUrl, category }]);
  
  if (insertError) {
    showToast("Failed to save product", "error");
    document.getElementById("loading").style.display = 'none';
    return;
  }

  showToast("Product added successfully!", "success");
  
  // Clear form
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  fileInput.value = "";
  
  await loadProducts();
  document.getElementById("loading").style.display = 'none';
}

// ================= DELETE PRODUCT =================
function deleteProduct(id, imageUrl) {
  document.getElementById("delete-id").value = id;
  document.getElementById("delete-image-url").value = imageUrl;
  document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteModal").style.display = "none";
}

async function confirmDeleteProduct() {
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    showToast("Not logged in", "error");
    return;
  }

  const id = document.getElementById("delete-id").value;
  const imageUrl = document.getElementById("delete-image-url").value;
  
  closeDeleteModal();
  document.getElementById("loading").style.display = 'flex';
  document.getElementById("loading").innerText = "Deleting Product...";

  // Delete from DB
  const { error: dbError } = await client.from("products").delete().eq("id", id);
  if (dbError) {
    showToast("Failed to delete product from database", "error");
    document.getElementById("loading").style.display = 'none';
    return;
  }

  // Attempt to delete from storage (extract filename from URL)
  if (imageUrl && imageUrl.includes('/products/')) {
    const parts = imageUrl.split('/products/');
    if (parts.length > 1) {
      const fileName = parts[1];
      await client.storage.from("products").remove([fileName]);
    }
  }

  // Remove from UI without refresh
  const card = document.getElementById(`product-${id}`);
  if (card) {
    card.remove();
  }

  showToast("Product deleted successfully", "success");
  document.getElementById("loading").style.display = 'none';
}

// ================= EDIT PRODUCT =================
function editProduct(id, name, price, category, oldImage) {
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-price").value = price;
  document.getElementById("edit-category").value = category;
  document.getElementById("edit-old-image").value = oldImage;
  document.getElementById("editModal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("edit-image").value = ""; // Clear file input
}

async function saveEditProduct() {
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    showToast("Not logged in", "error");
    return;
  }

  const id = document.getElementById("edit-id").value;
  const name = document.getElementById("edit-name").value;
  const price = document.getElementById("edit-price").value;
  const category = document.getElementById("edit-category").value;
  const oldImageUrl = document.getElementById("edit-old-image").value;
  const fileInput = document.getElementById("edit-image");
  const file = fileInput.files[0];

  closeEditModal();
  document.getElementById("loading").style.display = 'flex';
  document.getElementById("loading").innerText = "Saving Product...";

  let finalImageUrl = oldImageUrl;

  // Upload new image if provided
  if (file) {
    const fileName = Date.now() + "_" + file.name;
    const { data, error: uploadError } = await client.storage.from("products").upload(fileName, file);
    if (uploadError) {
      showToast("Image upload failed", "error");
      document.getElementById("loading").style.display = 'none';
      return;
    }
    finalImageUrl = `${supabaseUrl}/storage/v1/object/public/products/${fileName}`;
    
    // Attempt to delete old image from storage to save space
    if (oldImageUrl && oldImageUrl.includes('/products/')) {
      const parts = oldImageUrl.split('/products/');
      if (parts.length > 1) {
        await client.storage.from("products").remove([parts[1]]);
      }
    }
  }

  // Update DB
  const { error: updateError } = await client.from("products")
    .update({ name, price, category, image: finalImageUrl })
    .eq("id", id);

  if (updateError) {
    showToast("Failed to update product", "error");
    document.getElementById("loading").style.display = 'none';
    return;
  }

  showToast("Product updated successfully", "success");
  await loadProducts(); // Refresh the grid to show new data
  document.getElementById("loading").style.display = 'none';
}

// ================= AUTH =================
async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("error-msg");
  
  if(errorMsg) errorMsg.innerText = "Signing in...";

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if(errorMsg) errorMsg.innerText = "Incorrect credentials. Please try again.";
    else alert("Incorrect credentials");
    return;
  }

  // Redirect to dashboard
  window.location.href = "dashboard.html";
}

async function logoutAdmin() {
  await client.auth.signOut();
  window.location.href = "index.html";
}

async function checkUser() {
  const { data } = await client.auth.getUser();

  const admin = document.getElementById("adminPanel");

  if (data.user) {
    if (admin) admin.style.display = "block";
    console.log("User logged in");
  } else {
    if (admin) admin.style.display = "none";
    console.log("User not logged in");
  }
}

// ================= LOAD CONTENT =================
async function loadContent() {
  const { data, error } = await client.from("site_content").select("*");
  if (error) {
    console.error("Error loading content:", error.message);
    return;
  }
  
  if (data && data.length > 0) {
    data.forEach(item => {
      // Update public site text if elements exist
      const textElement = document.getElementById(`desc-${item.section_key}`);
      if (textElement) {
        textElement.innerText = item.description;
      }
      // Update admin textarea if elements exist
      const inputElement = document.getElementById(`edit-${item.section_key}-desc`);
      if (inputElement) {
        inputElement.value = item.description;
      }
    });
  }
}

// ================= UPDATE CONTENT =================
async function updateContent() {
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    alert("Not logged in");
    return;
  }
  
  const heroSubtitle = document.getElementById("edit-hero-subtitle").value;
  const weddingDesc = document.getElementById("edit-wedding-desc").value;
  const corporateDesc = document.getElementById("edit-corporate-desc").value;
  const aboutDesc = document.getElementById("edit-about-desc").value;
  
  const msgEl = document.getElementById("content-msg");
  
  msgEl.innerText = "Saving...";
  msgEl.style.color = "#d4af37";

  async function saveSection(key, text) {
    if (!text) return { error: null }; // Skip if empty
    const { data } = await client.from("site_content").select("id").eq("section_key", key);
    if (data && data.length > 0) {
      return await client.from("site_content").update({ description: text }).eq("section_key", key);
    } else {
      return await client.from("site_content").insert([{ section_key: key, description: text }]);
    }
  }

  const { error: err1 } = await saveSection('hero-subtitle', heroSubtitle);
  const { error: err2 } = await saveSection('wedding', weddingDesc);
  const { error: err3 } = await saveSection('corporate', corporateDesc);
  const { error: err4 } = await saveSection('about-desc', aboutDesc);
  
  if (err1 || err2 || err3 || err4) {
    console.error("Update error:", err1 || err2 || err3 || err4);
    msgEl.style.color = "#ff4444";
    msgEl.innerText = "Failed to save. Ensure 'site_content' table exists.";
    showToast("Failed to save content", "error");
  } else {
    msgEl.style.color = "#25D366";
    msgEl.innerText = "Content saved successfully!";
    showToast("Content updated successfully", "success");
    setTimeout(() => { msgEl.innerText = ""; }, 3000);
  }
}

// ================= ENQUIRY SYSTEM =================
async function handleEnquiry(event) {
  event.preventDefault();
  
  const nameEl = document.getElementById("enquiry-name");
  const emailEl = document.getElementById("enquiry-email");
  const phoneEl = document.getElementById("enquiry-phone");
  const typeSelect = document.getElementById("enquiry-type");
  const messageEl = document.getElementById("enquiry-message");
  
  const name = nameEl.value;
  const email = emailEl.value;
  const phone = phoneEl.value;
  const occasion = typeSelect.value !== "" ? typeSelect.options[typeSelect.selectedIndex].text : "Not specified";
  const message = messageEl.value;
  
  const btn = document.getElementById("enquiry-submit-btn");
  const originalText = btn.innerText;
  btn.innerText = "Sending...";
  btn.disabled = true;

  console.log("Submitting Enquiry Payload:", { name, email, phone, occasion, message });

  const { error } = await client.from("enquiries").insert([{
    name,
    email,
    phone,
    occasion,
    message
  }]);

  if (error) {
    console.error("Enquiry Insert Error Details:", error);
    showToast("Failed to send enquiry. Please try again.", "error");
    btn.innerText = originalText;
    btn.disabled = false;
    return;
  }

  console.log("Enquiry Inserted Successfully!");
  showToast("Enquiry sent successfully! We will contact you soon.", "success");
  
  // Robustly clear form fields
  try {
    document.getElementById("enquiry-form").reset();
  } catch(e) {
    console.error("Form reset error:", e);
  }
  nameEl.value = "";
  emailEl.value = "";
  phoneEl.value = "";
  typeSelect.selectedIndex = 0;
  messageEl.value = "";

  btn.innerText = originalText;
  btn.disabled = false;
}

async function loadEnquiries() {
  const container = document.getElementById("enquiries-list");
  if (!container) return; // Only runs on admin dashboard

  const { data, error } = await client
    .from("enquiries")
    .select("*")
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Load Enquiries Error:", error);
    return;
  }

  const countEl = document.getElementById("enquiry-count");
  if (countEl) {
    const pendingCount = data.filter(e => e.status !== 'completed').length;
    countEl.innerText = `${pendingCount} pending`;
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p style='color: rgba(255,255,255,0.5);'>No enquiries yet.</p>";
    return;
  }

  data.forEach(enq => {
    const isCompleted = enq.status === 'completed';
    const date = new Date(enq.created_at).toLocaleString();
    
    let actionBtn = isCompleted 
      ? `<span style="color:#25D366; font-size:0.8rem; text-transform:uppercase; display:flex; align-items:center; gap:0.5rem;">✓ Completed</span>`
      : `<button onclick="markEnquiryComplete('${enq.id}')" class="btn-complete">Mark Done</button>`;

    container.innerHTML += `
      <div class="enquiry-card ${isCompleted ? 'completed' : ''}" id="enq-${enq.id}">
        <div class="enquiry-header">
          <div class="enquiry-name">${enq.name}</div>
          <div class="enquiry-date">${date}</div>
        </div>
        <div class="enquiry-details">
          <div class="enquiry-detail-item">
            <label>Email</label>
            <span>${enq.email || 'N/A'}</span>
          </div>
          <div class="enquiry-detail-item">
            <label>Phone</label>
            <span>${enq.phone}</span>
          </div>
          <div class="enquiry-detail-item">
            <label>Occasion</label>
            <span>${enq.occasion}</span>
          </div>
        </div>
        <div class="enquiry-message">
          ${enq.message || 'No additional requirements provided.'}
        </div>
        <div class="enquiry-actions">
          ${actionBtn}
          <button onclick="deleteEnquiry('${enq.id}')" class="btn-danger" style="padding: 0.5rem 1rem; font-size: 0.8rem;">Delete</button>
        </div>
      </div>
    `;
  });
}

async function markEnquiryComplete(id) {
  const { error } = await client.from("enquiries").update({ status: 'completed' }).eq("id", id);
  if (error) {
    showToast("Failed to update status", "error");
    return;
  }
  showToast("Enquiry marked as completed", "success");
  loadEnquiries();
}

async function deleteEnquiry(id) {
  if (!confirm("Are you sure you want to delete this enquiry?")) return;
  
  const { error } = await client.from("enquiries").delete().eq("id", id);
  if (error) {
    console.error("Delete Enquiry Error:", error);
    showToast("Failed to delete enquiry", "error");
    return;
  }
  
  const card = document.getElementById(`enq-${id}`);
  if (card) card.remove();
  
  showToast("Enquiry deleted", "success");
  loadEnquiries(); // Refresh count
}

function subscribeToEnquiries() {
  const container = document.getElementById("enquiries-list");
  if (!container) return; // Only subscribe if on admin dashboard

  console.log("Subscribing to realtime enquiries...");
  client
    .channel('custom-all-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'enquiries' },
      (payload) => {
        console.log('Realtime Enquiry Change received!', payload);
        loadEnquiries(); // Re-fetch the list to update UI
      }
    )
    .subscribe((status) => {
      console.log('Realtime status:', status);
    });
}

// ================= INIT =================
console.log("JS connected");
checkUser();
loadContent();
loadProducts();
loadEnquiries();
subscribeToEnquiries();

window.onload = () => {
  console.log("JS loaded properly");
};


const isMobile = window.innerWidth < 768;

if (isMobile) {

  // MOBILE VERSION
  const video1 = document.getElementById("video1");
  const video2 = document.getElementById("video2");

  video2.style.display = "none";

  video1.src = "./mobile.mp4";
  video1.play();

} else {

  // DESKTOP VERSION
  const videos = [
    "./output.mp4",
    "./second.mp4"
  ];

  const v1 = document.getElementById("video1");
  const v2 = document.getElementById("video2");

  let currentIndex = 0;

  let activeVideo = v1;
  let nextVideo = v2;

  function startVideo(video, src) {
    video.src = src;
    video.load();

    video.oncanplay = () => {
      video.play();
    };
  }

  startVideo(activeVideo, videos[currentIndex]);

  activeVideo.onended = transition;

  function transition() {

    currentIndex = (currentIndex + 1) % videos.length;

    startVideo(nextVideo, videos[currentIndex]);

    nextVideo.style.opacity = 1;
    activeVideo.style.opacity = 0;

    setTimeout(() => {

      activeVideo.pause();

      [activeVideo, nextVideo] = [nextVideo, activeVideo];

      activeVideo.onended = transition;

    }, 1000);
  }

}