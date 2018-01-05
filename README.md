# odata-resource
<!---
    jsdoc -d ../github/odata-resource/ index.js -R README.md
-->

See the [Home Page](https://adamspe.github.io/odata-resource/) for the contents of this README and the jsdoc for the Resource base class (the module's export).

Node.Js module to allow for creation of REST resources served up via [ExpressJS](expressjs.com) and persisting data via [Mongoose](mongoosejs.com) that:

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

# Limitations

The `$filter` implementation is not entirely complete and is only `odata`'ish in nature.  Support for all operators is not complete.  Two non-odata operators `in` and `notin` have been implemented.  What is implemented:

## Logical Operators
- `eq` - Equal. E.g. `/api/books?$filter=title eq 'Book Title'`
- `ne` - Not equal. E.g. `/api/books?$filter=title ne 'Book Title'`
- `lt` - Less than. E.g. `/api/books?$filter=pages lt 200`
- `le` - Less than or equal. E.g. `/api/books?$filter=pages le 200`
- `gt` - Greater than. E.g. `/api/books?$filter=pages gt 200`
- `le` - Greater than or equal. E.g. `/api/books?$filter=pages ge 200`
- `and` - Logical and. E.g. `/api/books?$filter=pages ge 200 and pages le 400`
- `or` - Logical and. E.g. `/api/books?$filter=genre eq 'Action' or genre eq 'Fantasy'`

## Functions
- `startswith` E.g. `/api/books?$filter=startswith(title,'The')`
- `endswith` E.g. `/api/books?$filter=endswith(title,'The')`
- `contains` E.g. `/api/books?$filter=contains(title,'The')`

## Non-Odata
- `in` E.g. `/api/books?$filter=in(genre,'Action','Drama')`
- `notin` E.g. `/api/books?$filter=notin(genre,'Action','Drama')`

Parenthesis can be used in `$filter` to group logical conditions.  You just cannot mix `and` and `or` within a single sub-expression (set of parenthesis).

Examples:
`/api/books?$filter=(genre eq 'Action' or genre eq 'Fantasy') and pages lt 500`
`/api/books?$filter=(genre eq 'Action' or genre eq 'Fantasy') and (contains(title,'Lion') or contains(title,'Dragon'))`

_Case Sensitivity:_ Due to the performance implications on large collections all string related filtering is unadulterated meaning it's case sensitive.  For the time being if you need case insensitive filtering you may need to consider a solution like storing a lower case version of the property you wish to perform such filtering on.

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
        firstname: { type: String, required: true, trim: true },
        lastname: { type: String, required: true, trim: true }
    }),
    Book: mongoose.model('Book',{
        title: { type: String, required: true, trim: true },
        _author: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Author'},
        genre: { type: String, required: true, trim: true },
        pages: { type: Number, required: false, min: 1 }
    }),
    Review: mongoose.model('Review',{
        _book: {type: mongoose.Schema.Types.ObjectId, required: true},
        content: { type: String, required: true, trim: true },
        stars: { type: Number, required: true, min: 1, max: 5 },
        updated: { type: Date, default: Date.now }
    })
};

var authors = new Resource({
        rel: '/api/authors',
        model: models.Author,
    })
    // Note: this implementation of a custom relationship is just an
    // example.  In this simple case you wouldn't do this because the
    // more simple declarative version (like /api/books/<id>/reviews below)
    // would suffice, you'd just need to postpone the call to
    // instanceLink until -after- the books resource was created
    .instanceLink('books',function(req,res){ // custom relationship
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
# Count (experimental)

An implicit relationship `count` (similar to the odata `$count`) has been added that will return the integer count of a resource when listed or traversed from another entity relationship.

**Important:** This functionality must be explicitly enabled when constructing a resource by specifying the `count` key on the resource definition object.

For example:

```
var reviews = new Resource({
        rel: '/api/reviews',
        model: models.Review,
        count: true
    }),
    books = new Resource({
        rel: '/api/books',
        model: models.Book,
        $orderby: 'title',
        count: true
    }).instanceLink('reviews',{ // simple instance based relationship
        otherSide: reviews,
        key: '_book'
    });
```

Then list responses for `/api/books` and `/api/reviews` will contain a static link named `count` that will allow for counting of listed entities.  Similarly when traversing the relationship from `book` to `review` like `/api/book/<id>/reviews` a `count` relationship will be exposed on the reviews response allowing those results to be counted.

In both cases the `$filter` parameter will be honored.  For example `/api/books/count` will return the total number of books while `/api/books/count?$filter=pages ge 100` will the number of books with more than 99 pages.

The same holds true for relationships.  For example `/api/books/<id>/reviews` will return the number of reviews for a given book while `/api/books/<id>/reviews?$filter=stars gt 1` will return the number of reviews for a given book with more than one star.

Example output without `$filter` for a book's reviews like `/api/books/<id>/reviews`:

```
{
    list: [{
        _id: "5768a1f6db20b190e421c777",
        content: "Loved it!",
        stars: 5,
        _book: "5768a1f6db20b190e421c775",
        updated: "2016-06-21T02:09:58.199Z",
        __v: 0,
        _links: {
            self: "/api/reviews/5768a1f6db20b190e421c777"
        }
    },{
        _id: "5768a1f6db20b190e421c778",
        content: "Hated it!",
        stars: 1,
        _book: "5768a1f6db20b190e421c775",
        updated: "2016-06-21T02:09:58.201Z",
        __v: 0,
        _links: {
            self: "/api/reviews/5768a1f6db20b190e421c778"
        }
    }],
    _links: {
        count: "/api/books/5768a1f6db20b190e421c775/reviews/count"
    }
}
```

Example output with `$filter` for a book's five star reviews like `/api/books/<id>/reviews?$filter=stars eq 5`

```
{
    list: [{
        _id: "5768a1f6db20b190e421c777",
        content: "Loved it!",
        stars: 5,
        _book: "5768a1f6db20b190e421c775",
        updated: "2016-06-21T02:09:58.199Z",
        __v: 0,
        _links: {
            self: "/api/reviews/5768a1f6db20b190e421c777"
        }
    }],
    _links: {
        count: "/api/books/5768a1f6db20b190e421c775/reviews/count?%24filter=stars%20eq%205"
    }
}
```

In the relationship case it's important to understand that it's the "other side" object that dictates wether the `count` relationship will be added.  In the above example if `count` had not been specified (or set to `false`) when constructing the reviews resource then there woudl be no such relationship like `/api/books/<id>/reviews/count` because reviews don't support counting.

The routes for `count` only exist for basic relationships where the `instanceLink` function is supplied `otherSide` and `key` as input.

# Testing

Requires that `mongod` be running on the default port.

```
% npm install -g mocha
...
% npm test
```

# New in 1.0

The `or` operator has been implemented for the `$filter` parameter and the use of parenthesis for grouping within `$filter`.

Filtering by date is now supported.  E.g. `$filter=date lt 2018-01-01T00:00:00.000Z`
