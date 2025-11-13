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
    const connects = studyMate.collection("connects");

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
      try {
        const cursor = partners.find({});
        const allValues = await cursor.toArray();
        res.send(allValues);
      } catch (err) {
        res.status(500).send({ error: "can't find the user's data" });
      }
    });

    // api for userDetails
    app.get("/partner/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = ObjectId.isValid(id)
          ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] }
          : { _id: id };

        const partner = await partners.findOne(query);

        if (!partner) {
          return res.status(404).json({ error: "Partner not found" });
        }

        res.status(200).json(partner);
      } catch (err) {
        console.error("Error fetching partner profile:", err);
        res.status(500).json({ error: "Internal server error" });
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
        const sortField = [
          "rating",
          "experienceLevel",
          "partnerCount",
        ].includes(sort)
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

    // api for create partner profile and add it into db
    app.post("/create-profile", async (req, res) => {
      try {
        const newPartner = req.body;
        const existingUser = await partners.findOne({
          email: newPartner.email,
        });
        if (existingUser) {
          res.status(500).send({ error: "You already has partner profile" });
        } else {
          const result = await partners.insertOne(newPartner);
          res.send(result);
        }
      } catch (err) {
        res.status(500).send({ error: "Can't add user" });
      }
    });

    // add new connect to db
    app.post("/connects/add", async (req, res) => {
      try {
        const { userEmail, partnerEmail } = req.body;
        if (!userEmail || !partnerEmail) {
          return res
            .status(400)
            .send({ error: "Both userEmail and partnerEmail are required" });
        }

        const userConnects = await connects.findOne({ userEmail });

        if (userConnects) {
          const alreadyConnected = userConnects.connections?.some(
            (c) => c.partnerEmail === partnerEmail
          );

          if (alreadyConnected) {
            return res.status(400).send({ error: "Partner already connected" });
          }

          await connects.updateOne(
            { userEmail },
            { $push: { connections: { partnerEmail, sentAt: new Date() } } }
          );
        } else {
          await connects.insertOne({
            userEmail,
            connections: [{ partnerEmail, sentAt: new Date() }],
          });
        }

        const updatePartnerCount = await partners.updateOne(
          { email: partnerEmail },
          { $inc: { partnerCount: 1 } }
        );

        res.status(200).send({
          message: "Connection added successfully",
          updatePartnerCount,
        });
      } catch (err) {
        console.error("Error adding connection:", err);
        res.status(500).send({ error: "Can't add that user to your connects" });
      }
    });

    // get my connections
    app.get("/my-connects", async (req, res) => {
      const { userEmail } = req.query;

      const userConnects = await connects.findOne({ userEmail });

      if (!userConnects || !userConnects.connections) {
        return res.status(404).send({ message: "No connections found" });
      }

      const connectList = userConnects.connections;

      const partnerEmails = connectList.map((c) => c.partnerEmail);

      const myConnect = await partners
        .find({ email: { $in: partnerEmails } })
        .toArray();

      res.send(myConnect);
    });

    // api for delete a connect
    app.delete("/connects/delete", async (req, res) => {
      const { userEmail, partnerEmail } = req.query;

      if (!userEmail || !partnerEmail) {
        return res
          .status(400)
          .send({ error: "Both userEmail and partnerEmail are required" });
      }

      try {
        const result = await connects.updateOne(
          { userEmail },
          { $pull: { connections: { partnerEmail } } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ error: "Connection not found or already deleted" });
        }

        await partners.updateOne(
          { email: partnerEmail },
          { $inc: { partnerCount: -1 } }
        );

        const updatedUserConnects = await connects.findOne({ userEmail });

        if (
          !updatedUserConnects ||
          updatedUserConnects.connections.length === 0
        ) {
          await connects.deleteOne({ userEmail });
          return res.status(200).send({
            message:
              "All connections deleted, user removed from connects collection",
          });
        }

        res.status(200).send({ message: "Connection deleted successfully" });
      } catch (err) {
        console.error("Error deleting connection:", err);
        res.status(500).send({ error: "Failed to delete connection" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
