const { createDatabase } = require("./database");
const { createApp } = require("./app");

const db = createDatabase();
const port = Number(process.env.PORT || 3000);

createApp(db).listen(port, () => {
  console.log(`Clinic booking API listening on http://localhost:${port}`);
});
