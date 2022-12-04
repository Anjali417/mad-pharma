// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const {Payload} = require("dialogflow-fulfillment");
const nodemailer = require('nodemailer'); // Library to send emails
const vision = require('@google-cloud/vision'); // Library for OCR
const client = new vision.ImageAnnotatorClient();
const https = require('https'); 

 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements


var mysql = require('mysql'); // Library for MySQL DB Operations

var con = mysql.createConnection({
    host: "ls-1b6267a8358bd351a41b577eb51ed73c5264dd52.cbijwmhbeiuo.eu-north-1.rds.amazonaws.com",
    user: "root",
    password: "Frequency(417)",
    database: "dbgenpharma"
  }); // MySQL Client with user name and password
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => { // The main HTTPS on REQUEST function
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body)); // Write the request JSON to the log

  var SenderId = request.body.originalDetectIntentRequest.payload.data.sender.id; // rereive the sender id from facebook payload


function FacebookMedia() { // Triggers when user sends an image



    var url = request.body.originalDetectIntentRequest.payload.data.message.attachments[0].payload.url;

    return GoogleVision(url).then(function(result){ // Get best guessed label from google vision





        var WebDetection = result[0].webDetection;

        if(WebDetection.bestGuessLabels.length > 0){

            var BestLabel = WebDetection.bestGuessLabels[0]['label']; // best guessed label

            console.log(BestLabel);

            var FirstWord = BestLabel.split(" ");

            var Query = "SELECT * from medicine WHERE product_name LIKE '"+FirstWord[0]+"%' and instock > 100;"; // query the db with best guessed label

            return DbSelect(Query).then(function(result){





                
        if(JSON.parse(JSON.stringify(result)).length > 0){


            var ImageCards = [];
    
            result.forEach(element => { // make image card elements with the query results
    
                var ImageCardElement = {"title":element['product_name'],"subtitle":element['trade_price']+'£',"image_url":'http://16.16.27.161/assets/images/medicine/'+element['product_image'],"buttons":[{"type":"postback","title":'Search',"payload":element['generic_name']}]};
    
                ImageCards.push(ImageCardElement);
    
                
            });
    
    
            var MessengerPayload = {
                "attachment":{
                    "type": "template",
                    "payload":{
                        "elements": ImageCards,
                        "template_type": "generic"
                    }
                }
                    };
    
    
                    console.log('payload '+ JSON.stringify(MessengerPayload));
    
    
            agent.add(new Payload(agent.FACEBOOK,MessengerPayload, 
                  {
                    sendAsMessage: true,
                    rawPayload: false,
                  })
                ); // send messenger payload back to the user
    
    
        }else {
    
    
    
    
    
            agent.add('Sorry! The product that you are reffering to is either out of stock or unavailable.');
            // If no matching product was found
    
    
    
        }





            });

            

           


        }else{




            agent.add('Sorry! I am unable to process the image.');
            // Error while processing the image
        }
       







    });


 







}

  function ConfirmOrder(agent) { //triggers when confirming the order

    var Email = request.body.queryResult.outputContexts[0].parameters.Email;

    var Query = "select shopping_cart.product_id,shopping_cart.number_of_units,medicine.product_name,medicine.trade_price,shopping_cart.number_of_units * medicine.trade_price AS total from medicine,shopping_cart where medicine.product_id = shopping_cart.product_id and shopping_cart.sender_id = '"+SenderId+"';";
    // selecting the items in the shopping cart table
    return DbSelect(Query).then(function(result){




        if(JSON.parse(JSON.stringify(result)).length > 0){

            var SaleID = 'S'+Rand(1111111,9999999);
            var InvoiceNumber = Rand(11111111,99999999);
            var Due = 0.00;

            result.forEach(element => {

                Due = Due + element['total'];
                

            });
            //calculate the invoice number and the due amount

            var ShoppingCart = result;





            var Query1 = "insert into sales(cus_id,counter,sales_time,create_date,monthyear,entryid,total_discount,paid_amount,total_amount,due_amount,invoice_no,sale_id) values('WalkIn','ADMIN',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(CURDATE()),DATE_FORMAT(NOW(), '%Y-%m'),'U392','0','0','"+Due+"','"+Due+"','"+InvoiceNumber+"','"+SaleID+"');";
            // insert the items from shopping cart to the sales table

            return DbInsert(Query1).then(function(result){





                SendEmail(ShoppingCart,InvoiceNumber,Email,Due); //Send the confirmation email

                

                ShoppingCart.forEach(element => {




                    var Query2 = "insert into sales_details(sale_id,mid,cartoon,qty,rate,supp_rate,total_price,discount,total_discount) values('"+SaleID+"','"+element['product_id']+"','1','"+element['number_of_units']+"','"+element['trade_price']+"','"+element['trade_price']+"','"+element['total']+"','0','0');";
                    // insert details into the sales details table
                    return DbInsert(Query2).then(function(result){






                    




                    });



                });


                var Query3 = "DELETE from shopping_cart where sender_id = '"+SenderId+"';";
                //clear the shopping cart table after confirmation
                return DbDelete(Query3).then(function(result){





                    agent.add('Your order is confimed!\n\nInvoice Number: '+InvoiceNumber);
                    agent.add('Your invoice will be emailed shortly!');
                    // send the invoice number back to the user


                });

                


                













            });











        }else{



            agent.add("Your shopping cart is empty!")
            // if the cart is empty



        }








    });









  }


  function RemoveFromCart(agent) { //Remove items from the shopping cart



    var ProductID = request.body.queryResult.outputContexts[0].parameters.ProductID;

    var Query = "DELETE from shopping_cart WHERE sender_id = '"+SenderId+"' and product_id = '"+ProductID+"';";
    // delete a specific product from the cart
    return DbDelete(Query).then(function(result){






        agent.add(new Payload(agent.FACEBOOK, {
            "text": "Your shopping cart has been updated!",
            "quick_replies": [
              {
                "payload": "I would like to order some medications please.",
                "content_type": "text",
                "title": "I would like to order some more medications please."
              },
              {
                "content_type": "text",
                "payload": "View Cart",
                "title": "View Cart"
              }
            ]
          },
              {
                sendAsMessage: true,
                rawPayload: false,
              })
            );


              // prompt user to order more products









    });







  }

  function ViewCart(agent) { // Triggers when viewing the cart




    var Query = "select shopping_cart.product_id,shopping_cart.number_of_units,medicine.product_name,medicine.trade_price,medicine.product_image from medicine,shopping_cart where medicine.product_id = shopping_cart.product_id and shopping_cart.sender_id = '"+SenderId+"';";
    // select all items in the cart

    return DbSelect(Query).then(function(result){



        


        if(JSON.parse(JSON.stringify(result)).length > 0){


        var ImageCards = [];

        result.forEach(element => {

            var ImageCardElement = {"title":element['product_name'],"subtitle":element['trade_price']+'£ x '+element['number_of_units'],"image_url":'http://16.16.27.161/assets/images/medicine/'+element['product_image'],"buttons":[{"type":"postback","title":'Remove from cart',"payload":element['product_id']}]};

            ImageCards.push(ImageCardElement);

            
        }); // make image card elements with the query results


        var MessengerPayload = {
            "attachment":{
                "type": "template",
                "payload":{
                    "elements": ImageCards,
                    "template_type": "generic"
                }
            }
                };


                console.log('payload '+ JSON.stringify(MessengerPayload));


        agent.add(new Payload(agent.FACEBOOK,MessengerPayload,
              {
                sendAsMessage: true,
                rawPayload: false,
              })
            ); // send the payload with images to the user


    }else {





        agent.add('Your shopping cart is empty!');
        // if the shopping cart is empty.



    }


    });







  }
 
 
  function AddToCart(agent) {  // Triggers when adding items to the cart


       var ProductID = request.body.queryResult.outputContexts[0].parameters.ProductID;

       var NuOfPack = request.body.queryResult.parameters.NuOfPack;

       var Query1 = "DELETE from shopping_cart WHERE sender_id = '"+SenderId+"' and product_id = '"+ProductID+"';";
        // delete similar items from the cart

       console.log(Query1);


       var Query2 = "INSERT INTO shopping_cart (sender_id, product_id, number_of_units) VALUES ('"+SenderId+"', '"+ProductID+"', "+NuOfPack+");";
        // add items into the shopping cart table




        return DbDelete(Query1).then(function(result){




            
       return DbInsert(Query2).then(function(result){



       
        agent.add(new Payload(agent.FACEBOOK, {
           "text": "Your shopping cart has been updated!",
           "quick_replies": [
             {
               "payload": "I would like to order some medications please.",
               "content_type": "text",
               "title": "I would like to order some more medications please."
             },
             {
               "content_type": "text",
               "payload": "View Cart",
               "title": "View Cart"
             }
           ]
         },
             {
               sendAsMessage: true,
               rawPayload: false,
             })
           );
       // prompt the user to add more medication
       
       
       });







        });













  }

  function QueryMedication(agent) { // triggers when user enter a generic name
    







    var GenericName = request.body.queryResult.parameters.GenericName;


    var Query = "select * from medicine where generic_name like '"+GenericName+"%' and instock > 100;";
    // selec

    return DbSelect(Query).then(function(result){



        


        if(JSON.parse(JSON.stringify(result)).length > 0){


        var ImageCards = [];

        result.forEach(element => {

            var ImageCardElement = {"title":element['product_name'],"subtitle":element['trade_price']+'£',"image_url":'http://16.16.27.161/assets/images/medicine/'+element['product_image'],"buttons":[{"type":"postback","title":'Add to cart',"payload":element['product_id']}]};

            ImageCards.push(ImageCardElement);

            
        }); // make image cards with the query results


        var MessengerPayload = {
            "attachment":{
                "type": "template",
                "payload":{
                    "elements": ImageCards,
                    "template_type": "generic"
                }
            }
                };


                console.log('payload '+ JSON.stringify(MessengerPayload));


        agent.add(new Payload(agent.FACEBOOK,MessengerPayload,
              {
                sendAsMessage: true,
                rawPayload: false,
              })
            );
              // send the results to the user

    }else {





        agent.add('Sorry! The product that you are reffering to is either out of stock or unavailable.');
        // if the product is not available



    }


    });

   

  }









  let intentMap = new Map();
  intentMap.set('Query Medication', QueryMedication);
  intentMap.set('Query Medication - Add to cart - Number', AddToCart);
  intentMap.set('View Cart',ViewCart);
  intentMap.set('View Cart - Remove from cart',RemoveFromCart);
  intentMap.set('Confirm Order - Email',ConfirmOrder);
  intentMap.set('Facebook Media',FacebookMedia);
  agent.handleRequest(intentMap); // intent to functions mapping
});




function GoogleVision(url) {




    return new Promise((resolve, reject) => { 








        https.get(url, res => { 

           

            const bufs = [];

           

            res.on('data', function (chunk) {

                bufs.push(chunk) 

            }); // receive the image data

           

            res.on('end', function () {

               

                const data = Buffer.concat(bufs);
                // concatanete the image data into a single object

               



                var encoded = Buffer.from(data).toString('base64');






                client.webDetection(data).then(function(result){ // get the results from google vision api



                   
        
                    
        
                    resolve(result);
        
        
        
        
        
        
        
        
        
        
        
                });


            });


        });



       







      

        



    });











}




function DbDelete(DeleteQuery) { // Reusable delete query function which returns a promise once the operation is completed


    return new Promise((resolve, reject) => {
  
        
        con.connect(function(error){
  
  
  
            con.query(DeleteQuery,function(error,result,fields){
  
                if(error){
    
                    return reject(error);
    
                }else {
    
                    console.log('Res '+ JSON.stringify(result));
                    resolve(result);
                }
    
    
            });
  
  
  
  
  
  
        });
  
  
       
  
    
  
  
  
    });
  
  }





function DbSelect(SelectQuery) { // Reusable select query function which returns a promise once the operation is completed


  return new Promise((resolve, reject) => {

      
      con.connect(function(error){



          con.query(SelectQuery,function(error,result,fields){

              if(error){
  
                  return reject(error);
  
              }else {
  
                  console.log('Res '+ JSON.stringify(result));
                  resolve(result);
              }
  
  
          });






      });


     

  



  });

}





function DbUpdate(UpdateQuery) { // Reusable update query function which returns a promise once the operation is completed


    return new Promise((resolve, reject) => {
  
        
        con.connect(function(error){
  
  
  
            con.query(UpdateQuery,function(error,result,fields){
  
                if(error){
    
                    return reject(error);
    
                }else {
    
                    console.log('Res '+ JSON.stringify(result));
                    resolve(result);
                }
    
    
            });
  
  
  
  
  
  
        });
  
  
       
  
    
  
  
  
    });
  
  }




function DbInsert(InsertQuery) { // Reusable insert query function which returns a promise once the operation is completed


    return new Promise((resolve, reject) => {
  
        
        con.connect(function(error){
  
  
  
            con.query(InsertQuery,function(error,result,fields){
  
                if(error){
    
                    return reject(error);
    
                }else {
    
                    console.log('Res '+ JSON.stringify(result));
                    resolve(result);
                }
    
    
            });
  
  
  
  
  
  
        });
  
  
       
  
    
  
  
  
    });
  
  }

  function Rand(min, max) {  // returns a random number between two given number range
    return Math.floor(
      Math.random() * (max - min) + min
    )
  }


  function SendEmail (ShoppingCart,InvoiceNumber,Email,Due) { // function to send email

    let date_ob = new Date();

    var msg = 'Hello,\n\n\n\n'; 

    msg = msg + 'Invoice Number: '+InvoiceNumber+'\n\n';

    msg = msg + 'Date: '+date_ob+'\n\n';

    msg = msg + 'Items\n\n\n';

    ShoppingCart.forEach(element=>{



        msg = msg + element['product_name'] + ' ' + element['trade_price'] + ' x ' + element['number_of_units'] + ' = ' + element['total'] + '\n\n';




    }); // adding all items in the shopping cart to the email

    msg = msg + 'Total Due: '+ Due + '\n\n';

    msg = msg + 'Thank you';



    nodemailer.createTestAccount((err, account) => {

        

        let transporter = nodemailer.createTransport({

            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {

                user: account.user, 

                pass: account.pass 

            }

        }); // create the nodemailder client



      

        let mailOptions = {

            from: '"mad Pharma" <billing@madpharma.com>', 
            to: Email, 
            subject: 'New Order', 
            text: msg 

        };



       

        transporter.sendMail(mailOptions, (error, info) => {

            if (error) {

                return console.log(error);

            }

            console.log('Message sent: %s', info.messageId);

           

            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));


        }); // send the mail and get the message id and the url

    });













  }