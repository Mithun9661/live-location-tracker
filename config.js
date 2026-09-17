const crypto = require("crypto")

module.exports = {
    port: Number(process.env.PORT) || 6589,
    username: process.env.APP_USERNAME || "admin",
    password: process.env.APP_PASSWORD || "change-me",
    sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || ""
}
