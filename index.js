const express = require('express');
const cors = require('cors');
const app = express();

const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json());

app.get('/', (req, res) => {
    res.send('poris server is running');
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5nmtx0a.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri)


async function run() {
    try {
        const brandsCollection = client.db('poriComputers').collection('brands');
        const categoriesCollection = client.db('poriComputers').collection('category');
        const bookingsCollection = client.db('poriComputers').collection('bookings');

        app.get('/brands', async (req, res) => {
            const query = {}
            const cursor = brandsCollection.find(query);
            const brands = await cursor.toArray();
            res.send(brands)
        });

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id };
            const category = await categoriesCollection.find(query).toArray();
            // console.log(category)
            return res.send(category)
        });

        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            return res.send(bookings);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body
            console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            return res.send(result)
        });


    }

    finally {

    }
}

run().catch(error => console.error(error))


app.listen(port, () => {
    console.log(`Poris server running on port ${port}`);
})