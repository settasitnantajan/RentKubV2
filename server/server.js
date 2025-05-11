const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const app = express();

const { readdirSync } = require("fs");

const campingRoute = require("./routes/camping");
const profileRoute = require("./routes/profile");
const handleError = require("./middlewares/error");
require("dotenv/config");
const { clerkMiddleware } = require("@clerk/express");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));
app.use(clerkMiddleware());

readdirSync("./routes").map((r) => app.use("/api", require(`./routes/${r}`)));

app.use(handleError);

const port = 3000;
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
