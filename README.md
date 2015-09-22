# odata-resource

**Under Development, incomplete (no $filter only GET so far) and in-flux**

Node.Js module intended to allow for creation of REST resources served up via [ExpressJS](expressjs.com) and persisting data via [Mongoose](mongoosejs.com) that:

- Supports [OData](http://www.odata.org/) query arguments like; `$filter`, `$orderby`, `$select`, `$top` and `$skip`.
- Supports simple, resource definitions requiring minimal code.
- Supports static and instance based relationships between entities.
- Allows for Mongoose models to be defined and used independent of the resource implementation.
- Allows for a high degree of customization/over-riding of default behavior.

I found a few other modules that use the same basic components but invariably they wouldn't create the kinds of resources I wanted to be working with so I decided to write my own.

# Requirements

If exposing resources that support create (POST) and update (PUT) then your Express app must be able to parse JSON as input and you should use [body-parser](https://github.com/expressjs/body-parser) to get that done.

```
var app = require('express')();

app.use(require('body-parser').json());
```

# Examples

The most basic resource might look something like:

```
var mongoose = require('mongoose')
    Resource = require('odata-resource'),
    app = require('express')();

// build the Mongoose Model
var bookModel = mongoose.model('Book',{
        title: String,
        genre: String
    });

// define the REST resource
var bookResource = new Resource({
    rel: '/api/books',
    model: bookModel
});

// setup the routes
bookResource.initRouter(app);
```

A more complex set of objects might define relationships to one another like:

```
var models = {
    Author: mongoose.model('Author',{
        firstname: String,
        lastname: String
    }),
    Book: mongoose.model('Book',{
        title: String,
        _author: {type: mongoose.Schema.Types.ObjectId, ref: 'Author'},
        genre: String
    }),
    Review: mongoose.model('Review',{
        _book: mongoose.Schema.Types.ObjectId,
        content: String,
        stars: Number
    })
};

var authors = new Resource({
        rel: '/api/authors',
        model: models.Author,
    }).instanceLink('books',function(req,res){ // custom relationship
        var query = books.initQuery(books.getModel().find({_author: req._resourceId}),req);
        query.exec(function(err,bks){
            if(err){
                return Resource.sendError(res,500,'error finding books',err);
            }
            books.listResponse(req,res,bks);
        });
    }),
    reviews = new Resource({
        rel: '/api/reviews',
        model: models.Review
    }),
    books = new Resource({
        rel: '/api/books',
        model: models.Book,
        $orderby: 'title',
        populate: '_author'
    }).instanceLink('reviews',{ // simple instance based relationship
        otherSide: reviews,
        key: '_book'
    }).staticLink('genres',function(req,res){ // static type based relationship
        this.getModel().distinct('genre',function(err,genres){
            if(err){
                return Resource.sendError(res,500,'error getting genres',err);
            }
            res.send(genres);
        });
    });
```

Default functionality can be over-ridden.  For example perhaps you have some middleware that annotates the incoming request with the authenticated user (`req.user`) and you want:

- To expose a static relationship named `me` that simply returns the currently logged in user.
- To prevent non-administrative users from seeing the existence of other users via list.
- To never expose a property containing sensitive information named `secret`.

```
var users = new Resource({
            rel: '/api/users',
            model: User,
            $select: '-secret', // under normal operation don't expose 'secret'
        });
    users.staticLink('me',function(req,res) {
        users.singleResponse(req,res,req.user,function(u){
            // using annotated object so need to drop secret explicitly
            u.secret = undefined;
            return u;
        });
    });
    // override the list (/api/users?$orderby=...)
    users.find = (function(self){
        var superFind = self.find;
        return function(req,res) {
            if(!req.user.isAdmin()) {
                // not an admin, only let them see themselves, but do
                // so as a normal list response so that the response can
                // also carry meta information.
                return users.listResponse(req,res,[req.user],function(u){
                    u.secret = undefined;
                    return u;
                });
            }
            return superFind.apply(self,arguments);
        };
    })(users);
```

# Testing

Requires that `mongod` be running on the default port.

```
% npm install -g mocha
...
% npm test
```
