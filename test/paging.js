var should = require('should'),
    util = require('./util/util'),
    models = util.models,
    api = util.api;


describe('Paging',function(){
    var theAuthor = {
            firstname: 'Joe',
            lastname: 'Author'
        },
        theBooks = [{
            title: 'B: Exciting Book',
            genre: 'Action'
        },{
            title: 'A: Sad Book',
            genre: 'Drama'
        },{
            title: 'C: Another Book',
            genre: 'Mystery'
        }];

    before(function(done){
        util.before(function(){
            models.Author.create(theAuthor,function(err,author){
                if(err) {
                    throw err;
                }
                theAuthor._id = author._id.toString();
                theBooks.forEach(function(book){
                    book._author = theAuthor._id;
                });
                models.Book.create(theBooks,function(err,books){
                    if(err) {
                        throw err;
                    }
                    books.forEach(function(b,i) {
                        theBooks[i]._id = b._id.toString();
                    });
                    done();
                });
            });
        });
    });


    after(util.after);

    it('page one (1)',function(done){
            api.get('/api/books?$orderby=title&$top=1')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[1],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.not.have.property('prev');
                    links.should.have.property('next');
                    done();
               });
    });
    it('page two (1)',function(done){
            api.get('/api/books?$orderby=title&$top=1&$skip=1')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[0],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.have.property('prev');
                    links.should.have.property('next');
                    done();
               });
    });
    it('page three (1)',function(done){
            api.get('/api/books?$orderby=title&$top=1&$skip=2')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[2],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.have.property('prev');
                    links.should.have.property('next');
                    done();
               });
    });
    it('page four (1)',function(done){
            api.get('/api/books?$orderby=title&$top=1&$skip=3')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(0);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.have.property('prev');
                    links.should.not.have.property('next');
                    done();
               });
    });
    it('page one (2)',function(done){
            api.get('/api/books?$orderby=title&$top=2')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(2);
                    util.testBook(res.body.list[0],theBooks[1],theAuthor);
                    util.testBook(res.body.list[1],theBooks[0],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.have.property('next');
                    done();
               });
    });
    it('page two (2)',function(done){
            api.get('/api/books?$orderby=title&$top=2&$skip=2')
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                    util.testBook(res.body.list[0],theBooks[2],theAuthor);
                    res.body.should.have.property('_links').and.be.instanceof(Object);
                    var links = res.body._links;
                    links.should.have.property('genres','/api/books/genres');
                    links.should.have.property('prev');
                    links.should.not.have.property('next');
                    done();
               });
    });
});