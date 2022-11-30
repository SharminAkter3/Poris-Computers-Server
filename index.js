const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { query } = require('express');
const stripe = require("stripe")(process.env.STRIPE_SECRET)

const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json());

//database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5nmtx0a.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// console.log(uri)

//user verify user with JWT 
function verifyJWT(req, res, next) {
    // console.log('token inside jwt', req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized access')
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
        if (error) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        console.log('decoded email ', decoded.email)
        next();
    })
}


async function run() {
    try {
        const brandsCollection = client.db('poriComputers').collection('brands');
        const categoriesCollection = client.db('poriComputers').collection('category');
        const bookingsCollection = client.db('poriComputers').collection('bookings');
        const usersCollection = client.db('poriComputers').collection('users');
        const paymentsCollection = client.db('poriComputers').collection('payments');
        const productsCollection = client.db('poriComputers').collection('products');


        //get product brand from database
        app.get('/brands', async (req, res) => {
            const query = {}
            const cursor = brandsCollection.find(query);
            const brands = await cursor.toArray();
            return res.send(brands)
        });

        //get specific product from database
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id };
            const category = await productsCollection.find(query).toArray();
            // console.log(category)
            return res.send(category)
        });

        //update category collection in database
        app.post('/category/:id', async (req, res) => {
            const products = req.body
            console.log(products);
            const result = await categoriesCollection.insertOne(products);
            return res.send(result)
        });

        //get booking product from database 
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            return res.send(bookings);
        })

        //update booking product from database 
        app.post('/bookings', async (req, res) => {
            const booking = req.body
            console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            return res.send(result)
        });

        //get booking product from database with specific id 
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingsCollection.findOne(query);
            return res.send(booking)
        });

        //update payment intent  
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            return res.send({
                clientSecret: paymentIntent.client_secret,
            })
        });

        //update payment status 
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updateResult = await bookingsCollection.updateOne(filter, updatedDoc)
            return res.send(updateResult);
        })

        // use jwt  
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '4d' })
                return res.send({ accessToken: token });
            }
            console.log(user);
            return res.status(403).send({ accessToken: '' })
        });

        // update usersCollection in database
        app.post('/buyers', verifyJWT, async (req, res) => {
            const buyer = req.body;
            const result = await usersCollection.insertOne(buyer);
            return res.send(result);
        });

        // update usersCollection in database
        app.post('/sellers', async (req, res) => {
            const seller = req.body;
            const result = await usersCollection.insertOne(seller);
            return res.send(result);
        });

        // get user whose role buyer
        app.get('/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            return res.send(buyers);
        });

        // get user whose role seller
        app.get('/sellers', async (req, res) => {
            const query = { role: 'seller' };
            const sellers = await usersCollection.find(query).toArray();
            return res.send(sellers);
        });

        //save product in database
        app.post('/products', async (req, res) => {
            const productInfo = req.body;
            console.log(productInfo)
            const products = await productsCollection.insertOne(productInfo);
            return res.send(products);
        });


        //get products by seller email 
        app.get('/products', async (req, res) => {

            const email = req.query.email;
            console.log(email)
            // console.log(decoded.email)

            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'forbidded acees!' })
            // }


            const query = {
                seller_email: email
            }


            const myProducts = await productsCollection.find(query).toArray();
            return res.send(myProducts);
            console.log(myProducts)
        })


        app.get('/buyers/admin/email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            return res.send({ isAdmin: user?.role === 'admin' });
        })


        app.put('/buyers/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            return res.send(result);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.get('/sellers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });

        app.get('/buyers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        })


        // delete speccific seller from database if admin access
        app.delete('/sellers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter)
            return res.send(result);
        });

        // delete speccific buyer from database if admin access
        app.delete('/buyers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter)
            return res.send(result);
        });


        // load advertised items from database
        app.get('/advertised_product', async (req, res) => {
            const query = {
                advertise: true
            };

            const result = await productsCollection.find(query).toArray();
            return res.json(result);
        })


        app.put('/advertise/product/:id', async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    advertise: true
                },
            };

            const result = await productsCollection.updateOne(filter, updateDoc, options);
            //    console.log(result);
            return res.json(result)
        })


    }

    finally {

    }
}

run().catch(error => console.error(error))

app.get('/', (req, res) => {
    res.send('poris server is running');
})

app.listen(port, () => {
    console.log(`Poris server running on port ${port}`);
})