require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;
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
    const partners = studyMate.collection("partners");

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

    // api for partner profiles data
    app.get("/partners", async (req, res) => {
      const cursor = partners.find({});
      const allValues = await cursor.toArray();
      res.send(allValues);
    });
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
