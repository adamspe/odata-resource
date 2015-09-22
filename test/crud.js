var should = require('should'),
    util = require('./util/util'),
    _ = require('lodash'),
    models = util.models,
    api = util.api;


describe('CRUD',function(){
    before(util.before);
    after(util.after);
    beforeEach(util.cleanDb);

    describe('Create',function(){
        it('simple create',function(done){
            var author = {
                firstname: 'Bob',
                lastname: 'Writer'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res) {
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    res.body.should.have.property('_id');
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    // now fetch the author to be certain it was persisted
                    api.get(res.body._links.self)
                       .expect(200)
                       .expect('Content-Type', /json/)
                       .end(function(err,res2) {
                          util.testAuthor(res2.body,res.body);
                          done();
                       });
                });
        });

        it('invalid content',function(done) {
            api.post('/api/authors')
               .send({firstname: 'Fred'}) // no last name
               .expect(500)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    res.body.should.be.instanceof(Object);
                    util.testError(res.body,{status: 500, message: 'create failure'});
                    done();
               });
        });

        it('simple related',function(done){
            var author = {
                firstname: 'Pablo',
                lastname: 'Poet'
            },
            book = {
                title: 'A Collection of Poems',
                genre: 'Poetry'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    book._author = author._id;
                    api.post('/api/books')
                       .send(book)
                       .expect(200)
                       .expect('Content-Type', /json/)
                       .end(function(err,res) {
                            if(err) {
                                return done(err);
                            }
                            book._id = res.body._id;
                            // _author should have been populated
                            util.testBook(res.body,book,author);
                            done();
                       });
               });
        });
    });

    describe('Update',function(){
        it('simple sparse (PATCH)',function(done){
            var author = {
                firstname: 'Manfred',
                lastname: 'Mystery'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    api.put(res.body._links.self)
                       .send({lastname: 'Smith'})
                       .expect(200)
                       .expect('Content-Type', /json/)
                       .end(function(err,res){
                          if(err) {
                            return done(err);
                          }
                          author.lastname = 'Smith';
                          util.testAuthor(res.body,author);
                          done();
                       })
                });
        });
        it('simple complete',function(done){
            var author = {
                firstname: 'Harold',
                lastname: 'Horror'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    api.put(res.body._links.self)
                       .send(_.extend({},res.body,{lastname: 'Jones'}))
                       .expect(200)
                       .expect('Content-Type', /json/)
                       .end(function(err,res){
                          if(err) {
                            return done(err);
                          }
                          author.lastname = 'Jones';
                          util.testAuthor(res.body,author);
                          done();
                       })
                });
        });
        it('invalid',function(done){
            var author = {
                firstname: 'Sigfried',
                lastname: 'Suspense'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    api.put(res.body._links.self)
                       .send({lastname: null}) // last name is required we can't remove it
                       .expect(500)
                       .expect('Content-Type', /json/)
                       .end(function(err,res){
                          if(err) {
                            return done(err);
                          }
                          util.testError(res.body,{status:500,message:'update failure'});
                          done();
                       })
                });
        });
        it('not found',function(done){
          api.put('/api/authors/foo')
             .send({firstname: 'Foo'})
             .expect(404)
             .end(function(err,res){
                done(err);
             });
        });
    });

    describe('Delete',function(){
        it('simple',function(done){
            var author = {
                firstname: 'Manfred',
                lastname: 'Mystery'
            };
            api.post('/api/authors')
               .send(author)
               .expect(200)
               .expect('Content-Type', /json/)
               .end(function(err,res){
                    if(err) {
                        return done(err);
                    }
                    author._id = res.body._id;
                    util.testAuthor(res.body,author);
                    api.delete(res.body._links.self)
                       .expect(200)
                       .end(function(err,res){
                            if(err) {
                                return done(err);
                            }
                            done();
                       });
                });
        });
        it('not found',function(done){
          api.delete('/api/authors/foo')
             .expect(404)
             .end(function(err,res){
                done(err);
             });
        });
    });
});