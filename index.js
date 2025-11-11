const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://mahfuj:mahfuj@cluster0.ioes0vz.mongodb.net/?appName=Cluster0";
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
app.get("/", (req, res) => {
  res.send("Server is running");
});
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const studyMate = client.db("study-mate");
    const users = studyMate.collection("users");

    // api for userData
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await users.findOne({ email: user.email });
        if (existingUser) {
          res.status(500).send({ error: "user already exist" });
        } else {
          const result = await users.insertOne(user);
          console.log(user);
          res.send(result);
        }
      } catch (err) {
        res.status(500).send({ error: "failed to insert user" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
