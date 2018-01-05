
var OdataCommon = function(method) {
    this.method = method;
};
OdataCommon.prototype.visit = function(visitor) {
    if(this.method) {
        if(typeof(visitor[this.method]) !== 'function') {
            throw 'Expression visitor does not implement \''+this.method+'\'';
        }
        visitor[this.method](this);
    } else {
        throw 'No visitor method defined';
    }
};

var OdataMethodCall = function(args,method) {
    this.args = args;
    OdataCommon.apply(this,[method]);
};
OdataMethodCall.prototype = new OdataCommon();
OdataMethodCall.prototype.getMethodName = function() { return this.method; };
OdataMethodCall.prototype.getArguments = function() { return this.args; };

var OdataBinary = function(lhs,rhs,op) {
    this.lhs = lhs;
    this.rhs = rhs;
    OdataCommon.apply(this,[op]);
};
OdataBinary.prototype = new OdataCommon();
OdataBinary.prototype.getLHS = function() { return this.lhs; };
OdataBinary.prototype.getRHS = function() { return this.rhs; };

var OdataLiteral = function(value,method) {
    this.value = value;
    OdataCommon.apply(this,[method]);
};
OdataLiteral.prototype = new OdataCommon();
OdataLiteral.prototype.getValue = function() { return this.value; };

var OdataStringLiteral = function(value) {
    OdataLiteral.apply(this,[value,'string_lit']);
}
OdataStringLiteral.prototype = new OdataLiteral();

var OdataDateLiteral = function(value) {
    OdataLiteral.apply(this,[value,'date_lit']);
}
OdataDateLiteral.prototype = new OdataLiteral();

var OdataNumberLiteral = function(value) {
    OdataLiteral.apply(this,[value,'number_lit']);
}
OdataNumberLiteral.prototype = new OdataLiteral();

var OdataBooleanLiteral = function(value) {
    OdataLiteral.apply(this,[value,'boolean_lit']);
}
OdataBooleanLiteral.prototype = new OdataLiteral();

var OdataProperty = function(prop) {
    this.property = prop;
    OdataCommon.apply(this,['property']);
};
OdataProperty.prototype = new OdataCommon();
OdataProperty.prototype.getPropertyName = function() { return this.property; };

var OdataBoolCommonExpression = function() {
    this.sub_expressions = [];
    OdataCommon.apply(this,[null/* operator gets set later */]);
};
OdataBoolCommonExpression.prototype = new OdataCommon();
OdataBoolCommonExpression.prototype.isEmpty = function() { return this.sub_expressions.length === 0; };
OdataBoolCommonExpression.prototype.addSubExpression = function(sub) { this.sub_expressions.push(sub); };
OdataBoolCommonExpression.prototype.visit = (function(superFunc){
    return function(visitor) {
        var self = this;
        // wrapping a single simple expression in an and/or
        // when there's nothing to and/or it with.
        // e.g. "name eq 'foo'"
        if(!self.method && self.sub_expressions.length === 1) {
            self.sub_expressions[0].visit(visitor);
            return;
        }
        superFunc.apply(self,arguments);
    };
})(OdataBoolCommonExpression.prototype.visit);

var WHITESPACE = 0,
    QUOTED_STRING = 1,
    WORD = 2,
    NUMBER = 3,
    OPEN_PAREN = 4,
    CLOSE_PAREN = 5,
    SYMBOL = 6,
    DATE = 7,
    COMPARISONS = ['eq','ne','lt','le','gt','ge'],
    LOGICALS = ['and','or'],
    METHODS = ['contains','startswith','endswith','in','notin'],
    IS_ALPHA_NUM = /^[a-z0-9_]+$/i, // added _ since it's common to prefix mongo properties with _
    IS_NUM = /^[0-9]+$/
    IS_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

var OdataExpressionParser = function() {
};
OdataExpressionParser.prototype.handleSubexpression = function(tokens) {
    var bce = new OdataBoolCommonExpression(),
        token,method,args,word1,comparison,word2;
    if(tokens.length) {
        while(true) {
            if(!(token = this.pop(tokens))) {
                break;
            }
            // first pass, no support for or nothing fancy just a list of ands
            if(!bce.isEmpty()) {
                if(!this.isLogical(token)) {
                    throw 'Expected logical operator but received \''+token.token+'\'';
                }
                if(!bce.method) {
                    bce.method = token.token;
                } else if(bce.method !== token.token) {
                    throw 'Mixing of logical operators without grouping parenthesis not supported';
                }
                token = this.pop(tokens,true,true);
            }
            if(token instanceof OdataBoolCommonExpression) {
                bce.addSubExpression(token);
                continue;
            }
            if(token.type !== WORD) {
                throw 'Expected word but got \''+token.token+'\'';
            }
            if(this.isMethod(token)) {
                method = token;
                this.pop(tokens,true,true,OPEN_PAREN);
                args = [];
                while(true) {
                    token = this.pop(tokens,true,true);
                    args.push(this.castSimple(token));
                    token = this.pop(tokens,true,true);
                    if(token.type === CLOSE_PAREN) {
                        break;
                    } else if(token.type !== SYMBOL || token.token !== ',') {
                        throw 'Missing separator between method arguments';
                    }
                }
                if(args.length === 0) {
                    throw 'Missing method arguments';
                }
                bce.addSubExpression(new OdataMethodCall(args,method.token));
            } else {
                word1 = token;
                comparison = this.pop(tokens,true,true);
                if(!this.isComparison(comparison)) {
                    throw 'Expected comparison but received \''+comparison.token+'\'';
                }
                word2 = this.pop(tokens,true,true);
                bce.addSubExpression(new OdataBinary(this.castSimple(word1),this.castSimple(word2),comparison.token));
            }
        }
    }
    return bce;
};
OdataExpressionParser.prototype.parse = function(filter) {
    var tokens = this.tokenize(filter),
        i,tok,
        cParen,subExpr;

    // iterate over the expression looking for nested parenthesized
    // when found replace their tokens with their parsed expression
    // repeat until no nested parenthesized expressions are found
    do {
        subExpr = null;
        for(i = tokens.length-1; i >= 0; i--) {
            i = this._skipHandledExpressions(tokens,i);
            if(i <= 0) {
                break;
            }
            tok = tokens[i];
            if(this.isMethod(tok)) {
                i = this._skipMethod(tokens,i);
                if(i === 0) {
                    // method ends expression
                    break;
                }
                continue;
            }
            if(tok.type === OPEN_PAREN) {
                if((cParen = this._endOfInnermostSubExpression(tokens,i)) >= 0) {
                  subExpr = this.handleSubexpression(tokens.slice(cParen+1,i));
                  // replace the tokens with the subExpr
                  tokens.splice(cParen,(i-cParen)+1,subExpr);
                  break;
                }
            }
        }
    } while(subExpr);

    return this.handleSubexpression(tokens);
};
OdataExpressionParser.prototype._skipHandledExpressions = function(tokens,i) {
    var tok;
    while(i >= 0) {
        tok = tokens[i];
        if(tok instanceof OdataBoolCommonExpression) {
            i--;
        } else {
            break;
        }
    }
    return i;
};
OdataExpressionParser.prototype._skipMethod = function(tokens,methodIndex) {
    var i = methodIndex-1;
    if(i < 0) {
        throw 'Unexpected end of expression';
    }
    var tok = tokens[i];
    if(tok.type !== OPEN_PAREN) {
        throw 'Missing open parenthesis on method';
    }
    while(i >= 0 && tok.type !== CLOSE_PAREN) {
        tok = tokens[--i];
    }
    return i;
};
OdataExpressionParser.prototype._endOfInnermostSubExpression = function(tokens,openParen) {
    var i,tok;
    for(i = openParen-1; i >= 0; i--) {
        i = this._skipHandledExpressions(tokens,i);
        tok = tokens[i];
        if(this.isMethod(tok)) {
            i = this._skipMethod(tokens,i);
            if(i === 0) {
                throw 'Unexpected end of expression';
            }
            continue;
        }
        if(tok.type === OPEN_PAREN) {
            return -1; // another nested expression
        }
        if(tok.type === CLOSE_PAREN) {
            return i; // hit end of expression before close
        }
    }
    return -1;
};
OdataExpressionParser.prototype.pop = function(tokens,skip_white,complain,expectedType) {
    if(typeof(skip_white) === 'undefined') { skip_white = true; }
    if(typeof(complain) === 'undefined') { complain = false; }

    var token = tokens.pop();
    if(!token) {
        return token;
    }
    while(skip_white && token.type === WHITESPACE) {
        token = tokens.pop();
        if(!token) {
            break;
        }
    }
    if(!token && complain) {
        throw 'Expected additional token but found none.';
    }
    if(expectedType && token && expectedType != token.type) {
        throw 'Expected '+ expectedType + ' but found '+token.type;
    }
    return token;
};
OdataExpressionParser.prototype.castSimple = function(token) {
    switch(token.type) {
        case QUOTED_STRING:
            return new OdataStringLiteral(token.token);
        case NUMBER:
            return new OdataNumberLiteral(parseInt(token.token));
        case WORD:
            if(token.token == 'true' || token.token == 'false') {
                return new OdataBooleanLiteral(token.token == 'true');
            }
            if(token.token === 'null') {
                return new OdataStringLiteral(null);
            }
            return new OdataProperty(token.token);
        case DATE:
            return new OdataDateLiteral(new Date(token.token));
        default:
            throw 'Unexpected token '+ token.token + ' (expected simple).';
    }
};
OdataExpressionParser.prototype.isLogical = function(token) {
    return token.type === WORD && LOGICALS.indexOf(token.token) !== -1;
};
OdataExpressionParser.prototype.isMethod = function(token) {
    return token.type === WORD && METHODS.indexOf(token.token) !== -1;
};
OdataExpressionParser.prototype.isComparison = function(token) {
    return token.type === WORD && COMPARISONS.indexOf(token.token) !== -1;
};
OdataExpressionParser.prototype.readDigits = function(val,start) {
    var end = start,
        len = val.length;
    while(end < len && !isNaN(parseInt(val.charAt(end)))) {
        end++;
    }
    return end;
};
OdataExpressionParser.prototype.readWord = function(val,start,other_valid) {
    var end = start,
        len = val.length,c;
    while(end < len) {
        c = val.charAt(end);
        if(IS_ALPHA_NUM.test(c) || c === '/' || c === '_' || c === '.' || c === '*' || c === '-' || c === ':') {
            end++;
        } else {
            break;
        }
    }
    return end;
};
OdataExpressionParser.prototype.readQuotedString = function(val,start) {
    var end = start,
        len = val.length;
    while(val.charAt(end) !== '\'' || (end < (len-1) && val.charAt(end+1) === '\'')) {
        end += val.charAt(end) !== '\'' ? 1 : 2;
        if(end > len) {
            throw 'Encountered unterminated quoted string in filter \''+val+'\'';
        }
    }
    return end;
};
OdataExpressionParser.prototype.readWhitespace = function(val,start) {
    var end = start,
        len = val.length;
    while(end < len && val.charAt(end) === ' ') {
        end++;
    }
    return end;
};
OdataExpressionParser.prototype.tokenize = function(filter) {
    var tokens = [],
        len = filter.length,
        current = 0,
        end = 0,c,w;
    while(true) {
        if(current >= len) {
            break;
        }
        c = filter.charAt(current);
        if(c === ' ') {
            end = this.readWhitespace(filter,current);
            tokens.push({type: WHITESPACE,token: filter.substr(current,(end-current))});
            current = end;
        } else if (c === '\'') {
            end = this.readQuotedString(filter,current+1);
            tokens.push({type: QUOTED_STRING,token: filter.substr((current+1),(end-current)-1)});
            current = end+1;
        } else if (IS_NUM.test(c)) {
            // a date starts with a number, test if this is a date
            end = this.readWord(filter,current);
            w = filter.substr(current,(end-current))
            if(IS_DATE.test(w)) {
                tokens.push({type: DATE, token: w});
                current = end;
            } else { // just a number
                end = this.readDigits(filter,current);
                tokens.push({type: NUMBER, token:parseInt(filter.substr(current,(end-current)))});
                current = end;
            }
        } else if(IS_ALPHA_NUM.test(c) || c === '*') {
            end = this.readWord(filter,current);
            tokens.push({type: WORD,token:filter.substr(current,(end-current))});
            current = end;
        } else if (c === '(') {
            tokens.push({type: OPEN_PAREN, token: '('});
            current++;
        } else if (c === ')') {
            tokens.push({type: CLOSE_PAREN, token: ')'});
            current++;
        } else if (',.+='.indexOf(c) !== -1) {
            tokens.push({type: SYMBOL, token: c});
            current++;
        } else {
            for(var i = tokens.length-1; i >= 0; i--) {
                console.log(`token[${i}]`,tokens[i]);
            }
            throw 'Unexpected character \''+c+'\' when parsing filter \''+filter+'\'';
        }
    }
    return tokens.reverse();
};

// will build a mongoose query object in the query property.
var MongooseVisitor = function() {
    this.query = {};
    this.curBoolConditions = null;
};
MongooseVisitor.prototype.condition = function(cond) {
    if(this.curBoolConditions) {
        this.curBoolConditions.push(cond);
    } else {
        this.query = cond;
    }
};
MongooseVisitor.prototype.simpleCondition = function(op,prop,value) {
    var c = {},
        match = {};
    match[op] = value;
    c[prop] = match;
    this.condition(c);
};
// OData doesn't have an 'in' method but it's useful...
// in(<property>,<literal>,<literal>...)
MongooseVisitor.prototype.in = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        in_args = args.slice(1).map(function(arg) {
            return arg.getValue();
        });
    this.simpleCondition('$in',prop,in_args);
};
MongooseVisitor.prototype.notin = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        in_args = args.slice(1).map(function(arg) {
            return arg.getValue();
        });
    this.simpleCondition('$nin',prop,in_args);
};
MongooseVisitor.prototype.regexEscape = function(str) {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
MongooseVisitor.prototype.startswith = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.simpleCondition('$regex',prop,new RegExp('^'+this.regexEscape(val)));
};
MongooseVisitor.prototype.endswith = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.simpleCondition('$regex',prop,new RegExp(this.regexEscape(val)+'$'));
};
MongooseVisitor.prototype.contains = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.simpleCondition('$regex',prop,new RegExp(this.regexEscape(val)));
};

MongooseVisitor.prototype.eq = function(expr) {
    this.simpleCondition('$eq',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};
MongooseVisitor.prototype.ne = function(expr) {
    this.simpleCondition('$ne',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};

MongooseVisitor.prototype.gt = function(expr) {
    this.simpleCondition('$gt',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};
MongooseVisitor.prototype.lt = function(expr) {
    this.simpleCondition('$lt',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};

MongooseVisitor.prototype.ge = function(expr) {
    this.simpleCondition('$gte',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};
MongooseVisitor.prototype.le = function(expr) {
    this.simpleCondition('$lte',expr.getLHS().getPropertyName(),expr.getRHS().getValue());
};

MongooseVisitor.prototype.logical = function(op,binary) {
    var self = this,
        conditions = [],
        c = {};
    c[op] = conditions;
    self.condition(c);
    var prevBoolConditions = self.curBoolConditions;
    self.curBoolConditions = conditions;
    binary.sub_expressions.forEach(function(expr) {
        expr.visit(self);
    });
    self.curBoolConditions = prevBoolConditions;
};
MongooseVisitor.prototype.and = function(binary) {
    this.logical('$and',binary);
};
MongooseVisitor.prototype.or = function(binary) {
    this.logical('$or',binary);
};
MongooseVisitor.prototype.string_lit = function(lit) {};
MongooseVisitor.prototype.date_lit = function(lit) {};
MongooseVisitor.prototype.number_lit = function(lit) {};
MongooseVisitor.prototype.boolean_lit = function(lit) {};
MongooseVisitor.prototype.property = function(prop) {};

module.exports = function(query,filter) {
    var visitor = new MongooseVisitor();
    (new OdataExpressionParser()).parse(filter).visit(visitor);
    query.where(visitor.query);
};

/*
var visitor = new MongooseVisitor(),
    parser = new OdataExpressionParser(),
    filter = `(name eq 'Bob' or (name eq 'Fred' and age eq 10 and (startswith(foo,'bar') or this eq 2))) and stars ne 2`,
    stringify = function(o) {
        console.log(JSON.stringify(o,null,'  '));
    };

filter='in(x,1,2,3) and name eq \'foo\'';
filter=`((type eq 'project' and deliverable eq 'map') or (type eq 'product' and type eq 'map')) and category eq 'foo'`;
filter=`name eq 'foo' or name eq 'bar'`;
filter=`(name eq 'foo' and age gt 10) or (name eq 'bar' and age gt 20)`
filter=`name eq 'foo'`
filter=`date eq 2014-06-23T03:30:00.000Z`

bce = parser.parse(filter);
console.log(`-----BCE---- "${filter}"`);
stringify(bce);
bce.visit(visitor);
console.log(`-----Mongo Query---- "${filter}"`);
stringify(visitor.query);
*/
