<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <div class="container">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <h1 class="title">Admin Panel</h1>
      <a class="btn secondary" href="index.html">← Beranda</a>
    </div>

    <div class="card">
      <h2>Login Admin</h2>
      <div class="row">
        <input id="email" placeholder="email admin" />
        <input id="password" type="password" placeholder="password" />
        <button id="loginBtn" class="btn">Login</button>
        <button id="logoutBtn" class="btn secondary">Logout</button>
        <small id="status"></small>
      </div>
    </div>

    <hr />

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">Confessions</h2>
        <button id="refreshBtn" class="btn secondary">Refresh</button>
      </div>
      <div id="list" class="list" style="margin-top:12px;"></div>
    </div>
  </div>

  <script type="module" src="admin.js"></script>
</body>
</html>
