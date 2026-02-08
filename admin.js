import { supabase } from "./supabaseClient.js";

window.addEventListener("DOMContentLoaded", () => {
  const loginSection = document.getElementById("loginSection");
  const adminPanel = document.getElementById("adminPanel");

  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const status = document.getElementById("loginStatus");

  function showLogin(msg=""){
    status.textContent = msg;
    loginSection.style.display = "block";
    adminPanel.style.display = "none";
  }
  function showPanel(){
    loginSection.style.display = "none";
    adminPanel.style.display = "block";
  }

  loginBtn.addEventListener("click", async () => {
    console.log("admin.js handler fired ✅");
    status.textContent = "Login...";

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      showLogin("Email & password wajib diisi");
      return;
    }

    // bersihin session lama biar gak “ketumpuk”
    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      await supabase.auth.signOut();
      showLogin("Login gagal: " + (error?.message || "Unknown error"));
      return;
    }

    // sukses login -> tampil panel
    showPanel();
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showLogin("");
  });

  // load awal
  showLogin("");
});
