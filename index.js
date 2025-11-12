require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

    // get single user's profile api
    app.get("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const user = await partners.findOne({ _id: new ObjectId(id) });
        console.log("api hitted");
        res.send(user);
      } catch (err) {
        res.status(404).send({ error: "cant't find the user" });
      }
    });

    // api for search partner
    app.get("/partners/search", async (req, res) => {
      const name = req.query.name;
      const searchedUsers = await partners
        .find({ name: { $regex: name, $options: "i" } })
        .toArray();
      res.send(searchedUsers);
    });

    // api for sorting partners
    app.get("/partners/sort", async (req, res) => {
      try {
        const { sort, order } = req.query;
        const sortField = ["rating", "experienceLevel", "patnerCount"].includes(
          sort
        )
          ? sort
          : null;

        if (!sortField) {
          return res.status(400).send({ error: "Invalid sort field" });
        }

        const sortOrder = order === "desc" ? -1 : 1;

        const cursor = partners.find({}).sort({ [sortField]: sortOrder });
        const sortedPartners = await cursor.toArray();

        res.send(sortedPartners);
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch sorted partners" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
