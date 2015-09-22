var debug = require('debug')('Resource'),
    express = require('express'),
    //odataParser = require("odata-parser"),
    querystring = require('querystring'),
    _ = require('lodash');

/**
 * <p>Constructs a resource.</p>
 *
 * <p>Keys</p>
 *
 * <ul>
 * <li>model (object): The instane of the Mongoose model (required).</li>
 * <li>rel (string): The absolute path of the new resource (required).</li>
 * <li>lean (boolean): Whether find[ById] queries should be 'lean' and return pojos (default true).  If false then
 *         resource instances, prior to mapping an object for return, could make use of methods on the instance model.</li>
 * <li>populate(string||Array): Specifies a property, or list of properties, to populate into objects.</li>
 * </ul>
 *
 * <p>The following keys set defaults for possible query arguments.</p>
 * <ul>
 * <li>$top (number): The default value for $top if not supplied on the query string (default none).</li>
 * <li>$skip (number): The default value for $skip if not supplied on the query string (default none).</li>
 * <li>$orderby (string): The default value for $orderby if not supplied on the query string (default none).  This value
 *                      must use odata syntax like "foo asc,bar desc,baz" rather than mongo syntax like "foo -bar baz".</li>
 * <li>$orderbyPaged (string): The name of an attribute to sort results by when clients are paging, send $top, but have not
 *                           explicitly sent $orderby. (default '_id').</li>
 * <li>$select (string): The default value for $select if not supplied on the query string (default none, all properties).
 *                     If a value is supplied then $select on the query string will be ignored to protect against the
 *                     situation where the intent is to hide internal attributes (e.g. '-secret').  Unlike odata the
 *                     syntax here is passed through to mongo so the '-' prefix will be honored.</li>
 * </ul>
 *
 * @constructor
 * @param {Object} definition The resource definition.
 */
var Resource = function(definition) {
    this._definition = definition;
};
/**
 * Send a response error.
 * @todo currently this function unconditionally sends the error with the response.
 * this may not be desirable since often exposing an error (e.g. stack trace) poses
 * a potential security vulnerability.
 *
 * @param  {Object} res     The express response object.
 * @param  {Number} rc      The response status code (default 500).
 * @param  {String} message The response message.
 * @param  {Object} err     The error object.
 */
Resource.sendError = function(res,rc,message,err) {
    rc = rc||500;
    res.status(rc).send({
        status: rc,
        message: message,
        err: err
    });
};
/**
 * @return {Object} The resource definition.
 */
Resource.prototype.getDefinition = function() {
    return this._definition;
};
/**
 * @return {String} The resource relative path.
 */
Resource.prototype.getRel = function() {
    return this._definition.rel;
};
/**
 * @return {Object} The underlying mongoose model.
 */
Resource.prototype.getModel = function() {
    return this._definition.model;
};
/**
 * @return {Array} The list of instance link names.
 */
Resource.prototype.getInstanceLinkNames = function() {
    var def = this.getDefinition();
    return def.instanceLinks ? Object.keys(def.instanceLinks) : [];
};
/**
 * @return {Array} The list of static link names.
 */
Resource.prototype.getStaticLinkNames = function() {
    var def = this.getDefinition();
    return def.staticLinks ? Object.keys(def.staticLinks) : [];
};
/**
 * Sends a single object instance response.
 *
 * @param  {Object}   req        The express request object.
 * @param  {Object}   res        The express response object.
 * @param  {Array}   objs        The array of objects to send.
 * @param  {Function}   [postMapper] Optional Array.map callback that will be called with each raw object instance.
 * @param  {Function} [next]       Optional next callback to invoe after the response is sent with the response object.
 */
Resource.prototype.singleResponse = function(req,res,obj,postMapper,next) {
    var response = this.getMapper(postMapper)(obj);
    res.send(response);
    if(typeof(next) === 'function') {
        next(null,response);
    }
};
/**
 * Sends a list response.
 *
 * @param  {Object}   req        The express request object.
 * @param  {Object}   res        The express response object.
 * @param  {Array}   objs        The array of objects to send.
 * @param  {Function}   [postMapper] Optional Array.map callback that will be called with each raw object instance.
 * @param  {Function} [next]       Optional next callback to invoe after the response is sent with the response object.
 */
Resource.prototype.listResponse = function(req,res,objs,postMapper,next) {
    var response = {
            list: objs.map(this.getMapper(postMapper))
        },
        rel = this.getRel(),
        links = this.getStaticLinkNames(),
        qDef = req.$odataQueryDefinition;
    if(links.length) {
        response._links = {};
        links.forEach(function(link) {
            response._links[link] = rel+'/'+link;
        });
    }
    if(qDef && qDef.$top) {
        // next,prev links
        response._links = response._links||{};
        // looks odd but $top could be part of the service definition so
        // if its there use it but over-ride if supplied by the client.
        var forwardArgs = _.extend({$top: qDef.$top},req.query),
            nextArgs = _.extend({},forwardArgs,{$skip:(parseInt(forwardArgs.$skip||0)+parseInt(forwardArgs.$top))})
            prevArgs = _.extend({},forwardArgs,{$skip:(parseInt(forwardArgs.$skip||0)-parseInt(forwardArgs.$top))}),
            baseUrl = req.originalUrl.replace(/\?.*$/,'');
        if(prevArgs.$skip >= 0) {
            response._links.prev = baseUrl+'?'+querystring.stringify(prevArgs);
        }
        // only add the next link if there are exactly the requested number of objects.
        // can't be sure if the next page might not be empty.
        if(response.list.length === parseInt(qDef.$top)){
            response._links.next = baseUrl+'?'+querystring.stringify(nextArgs);
        }
    }
    res.send(response);
    if(typeof(next) === 'function') {
        next(null,response);
    }
};
/**
 * Translates an Odata $orderby clause into a mongo version.
 * http://www.odata.org/documentation/odata-version-2-0/uri-conventions/ (section 4.2)
 *
 * @param  {String} $orderby The external odata $orderby clause
 * @return {String} The string equivalent of mongoose sort.
 */
function odataOrderBy($orderby) {
    if($orderby) {
        var mongo,
            clauseExp = /^([^\s]+)\s*(asc|desc|)$/;
        $orderby.split(',').forEach(function(clause) {
            var clause_parts = clauseExp.exec(clause.trim());
            if(!clause_parts) {
                debug('orderby clause "%s" invalid, ignoring.',clause);
            } else {
                var field = clause_parts[1],
                    direction = clause_parts[2];
                if(direction === 'desc') {
                    field = '-'+field;
                }
                mongo = mongo ? (mongo+' '+field) : field;
            }
        });
        debug('translated odata orderby "%s" to mongo sort "%s"',$orderby,mongo);
        return mongo;
    }
}
/**
 * Initializes a mongoose query from a user request.
 *
 * @param  {Object} query The mongoose query.
 * @param  {Object} req   The express request object.
 * @return {Object}       The mongoose query (query input argument).
 */
Resource.prototype.initQuery = function(query,req) {
    var base = this.getDefinition(),
        def = _.extend({
            $orderbyPaged: '_id'
        },base,req.query),
        populate = def.populate ?
            (_.isArray(def.populate) ? def.populate : [def.populate]) : [];
    populate.forEach(function(att){
        query.populate(att);
    });
    if(base.$select) {
        // don't let the caller over-ride to gain access to
        // fields that weren't intended.
        def.$select = base.$select;
    }
    if(def.$select) {
        query.select(def.$select);
    }
    if(typeof(def.lean) === 'boolean') {
        query.lean(def.lean);
    } else {
        query.lean(true); // by default go straight to a JavaScript object
    }
    if(def.$top) {
        query.limit(def.$top);
    }
    if(def.$skip) {
        query.skip(def.$skip);
    }
    if(def.$orderby) {
        query.sort(odataOrderBy(def.$orderby));
    } else if (def.$top) {
        // per the odata spec if the client is paging but not sorting then
        // we must impose a sort order to ensure responses are repeatable and
        // paged results are valid, _id is the only attribute we can count on
        // existing so sort on it.
        query.sort(def.$orderbyPaged);
    }
    if(def.$filter) {
        var parsed = odataParser.parse('$filter='+def.$filter);
        debug('parsed.$filter',parsed);
    }
    // save the query definiton for later re-use.
    req.$odataQueryDefinition = def;
    return query;
};
/**
 * <p>Builds a 'mapper' object that can be used to translate mongoose objects into
 * REST response objects.  This function can be passed to Array.map given an array of
 * mongoose objects.  All object results returned to a client should pass through a
 * mapper so that meta information like instance links can be attached.</p>
 *
 * <p><em>Note:</em> When sending custom responses you should use the [listResponse]{@link Resource#listResponse} or [singleResponse]{@link Resource#singleResponse} functions to do
 * so and those functions implicitly use a mapper.</p>
 *
 * @param  {function} postMapper Array.map callback that should be called after the underlying mapper does its work (optional).
 * @return {function}            An Array.map callback.
 */
Resource.prototype.getMapper = function(postMapper) {
    var model = this.getModel(),
        instanceLinkNames = this.getInstanceLinkNames(),
        rel = this.getRel();
    return function(o,i,arr) {
        if(typeof(o.toObject) === 'function') {
            if(!i) {
                // just log for single maps, or the first in an array.
                debug('%s: translating mongoose model to a pojo',rel);
            }
            o = o.toObject();
        }
        var selfLink = rel+'/'+o._id,
            links = {
                self: selfLink
            };
        instanceLinkNames.forEach(function(link) {
            links[link] = selfLink+'/'+link
        });
        o._links = links;
        return typeof(postMapper) === 'function' ? postMapper(o,i,arr) : o;
    };
};
/**
 * Fetches and returns to the client an entity by id.  Resources may
 * override this default functionality.
 *
 * @param  {Object} req The express request object.
 * @param  {Object} res The express response object.
 */
Resource.prototype.findById = function(req,res) {
    var self = this,
        def = this.getDefinition();
        query = this.initQuery(self.getModel().findById(req._resourceId),req);
    query.exec(function(err,obj){
        if(err) {
            Resource.sendError(res,404,'not found',err);
        } else {
            self.singleResponse(req,res,obj);
        }
    });
};
/**
 * Executes a query for an entity type and returns the response to the client.
 * Resources may override this default functionality.
 *
 * @param  {Object} req The express request object.
 * @param  {Object} res The express response object.
 */
Resource.prototype.find = function(req,res) {
    var self = this,
        def = this.getDefinition(),
        query = this.initQuery(self.getModel().find(),req);
    query.exec(function(err,objs){
        if(err){
            Resource.sendError(res,500,'find failed',err);
        } else {
            debug('found %d objects.', objs.length);
            self.listResponse(req,res,objs);
        }
    });
};
/**
 * Add a static link implementation to this resource.
 *
 * @param  {String} rel  The relative path of the link.
 * @param  {function} link A function to call when the static link is requested.  The
 *                         arguments are (req,res) which are the express request and response
 *                         objects respectively.
 * @return {Object}      this
 */
Resource.prototype.staticLink = function(rel,link) {
    // for now static links are functions only
    var def = this._definition,
        links = def.staticLinks;
    if(!links) {
        links = def.staticLinks = {};
    }
    links[rel] = link;
    return this;
};
/**
 * Add an instance link to this resource.
 *
 * The link argument can be either an object defining a simple relationship
 * (based on a reference from the 'other side' object) or a function to be called to
 * resolve the relationship.
 *
 * If a function is supplied then its arguments must be (req,res) which are the express
 * request and response objects respectively.
 *
 * If an object is supplied then the necessary keys are:
 * - otherSide (Object): The Resource instance of the other side entity.
 * - key (string): The attribute name on the otherside object containing the id of this Resource's entity type.
 *
 * @param  {String} rel  The relative path of the link.
 * @param  {Object|function} link The link definition.
 * @return {Object}      this
 */
Resource.prototype.instanceLink = function(rel,link) {
    var def = this._definition,
        links = def.instanceLinks;
    if(!links) {
        links = def.instanceLinks = {};
    }
    links[rel] = link;
    return this;
}
/**
 * Initializes and returns an express router.
 * If app is supplied then app.use is called to beind the
 * resource's 'rel' to the router.
 *
 * @param  {object} app Express app (optional).
 * @return {object}     Express router configured for this resource.
 */
Resource.prototype.initRouter = function(app) {
    var self = this,
        resource = self._definition,
        router = express.Router();
    if(resource.staticLinks) {
        Object.keys(resource.staticLinks).forEach(function(link){
            var linkObj = resource.staticLinks[link],
                linkObjType = typeof(linkObj);
            if(linkObjType === 'function') {
                router.get('/'+link,(function(self){
                    return function(req,res) {
                        linkObj.apply(self,arguments);
                    };
                })(self));
            }
        });
    }
    router.param('id',function(req,res,next,id){
        req._resourceId = id;
        next();
    });
    router.get('/:id',(function(self){
        return function(req,res) {
            self.findById(req,res);
        };
    })(this));
    router.get('/', (function(self){
        return function(req,res) {
            self.find(req,res);
        };
    })(this));
    if(resource.instanceLinks) {
        Object.keys(resource.instanceLinks).forEach(function(link){
            var linkObj = resource.instanceLinks[link],
                linkObjType = typeof(linkObj);
            if(linkObjType === 'function') {
                router.get('/:id/'+link,(function(self){
                    return function(req,res) {
                        resource.instanceLinks[link].apply(self,arguments);
                    };
                })(self));
            } else if(linkObj.otherSide instanceof Resource && linkObj.key) {
                router.get('/:id/'+link,
                    (function(self,otherSide,key) {
                        return function(req,res) {
                            var criteria = {};
                            criteria[key] = req._resourceId;
                            var query = otherSide.initQuery(otherSide.getModel().find(criteria),req);
                            query.exec(function(err,objs){
                                if(err) {
                                    return Resource.sendError(res,500,'error resolving relationship',err)
                                }
                                otherSide.listResponse(req,res,objs);
                            });
                        };
                    })(self,linkObj.otherSide,linkObj.key));
            }
        });
    }
    if(app) {
        app.use(this.getRel(),router);
    }
    return router;
};
module.exports = Resource;