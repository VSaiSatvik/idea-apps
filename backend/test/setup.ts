// imported first by every test so the env is set before any module reads it
process.env.PERSIST = "off";
process.env.ADMIN_EMAILS = "admin@demo.app";
process.env.PUBLIC_URL = "https://api.example.com";
