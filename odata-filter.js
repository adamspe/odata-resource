
var OdataCommon = function(method) {
    this.method = method;
};
OdataCommon.prototype.visit = function(visitor) {
    if(this.method) {
        if(typeof(visitor[this.method]) !== 'function') {
            throw 'Expression visitor does not implement \''+this.method+'\'';
        }
        visitor[this.method](this);
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

OdataBoolCommonExpression = function() {
    this.sub_expressions = [];
};
OdataBoolCommonExpression.prototype.isEmpty = function() { return this.sub_expressions.length === 0; };
OdataBoolCommonExpression.prototype.addSubExpression = function(sub) { this.sub_expressions.push(sub); };
OdataBoolCommonExpression.prototype.visit = function(visitor) {
    this.sub_expressions.forEach(function(expr) {
        expr.visit(visitor);
    });
};


var WHITESPACE = 0,
    QUOTED_STRING = 1,
    WORD = 2,
    NUMBER = 3,
    OPEN_PAREN = 4,
    CLOSE_PAREN = 5,
    SYMBOL = 6,
    COMPARISONS = ['eq','ne','lt','le','gt','ge'],
    LOGICALS = ['and']//,'or'],
    METHODS = ['contains','startswith','endswith','in','notin'],
    IS_ALPHA_NUM = /^[a-z0-9_]+$/i, // added _ since it's common to prefix mongo properties with _
    IS_NUM = /^[0-9]+$/;

var OdataExpressionParser = function() {
};
OdataExpressionParser.prototype.parse = function(filter) {
    var tokens = this.tokenize(filter),
        bce = new OdataBoolCommonExpression(),
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
                token = this.pop(tokens,true,true);
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
OdataExpressionParser.prototype.readWord = function(val,start) {
    var end = start,
        len = val.length,c;
    while(end < len) {
        c = val.charAt(end);
        if(IS_ALPHA_NUM.test(c) || c === '/' || c === '_' || c === '.' || c === '*') {
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
    while(val.charAt(end) != '\'' || (end < (len-1) && val.charAt(end+1) == '\'')) {
        end += val.charAt(end) != '\'' ? 1 : 2;
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
        end = 0,c;
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
            end = this.readDigits(filter,current);
            tokens.push({type: NUMBER, token:parseInt(filter.substr(current,(end-current)))});
            current = end;
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
            throw 'Unexpected character \''+c+'\' when parsing filter \''+filter+'\'';
        }
    }
    return tokens.reverse();
};


var MongooseVisitor = function(query) {
    this.query = query;
};
// OData doesn't have an 'in' method but we're not supporting or so...
// in(<property>,<literal>,<literal>...)
MongooseVisitor.prototype.in = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        in_args = args.slice(1).map(function(arg) {
            return arg.getValue();
        });
    this.query.where(prop).in(in_args);
};
MongooseVisitor.prototype.notin = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        in_args = args.slice(1).map(function(arg) {
            return arg.getValue();
        });
    this.query.where(prop).nin(in_args);
};
MongooseVisitor.prototype.regexEscape = function(str) {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
MongooseVisitor.prototype.startswith = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.query.where(prop).equals(new RegExp('^'+this.regexEscape(val)));
};
MongooseVisitor.prototype.endswith = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.query.where(prop).equals(new RegExp(this.regexEscape(val)+'$'));
};
MongooseVisitor.prototype.contains = function(method) {
    var args = method.getArguments(),
        prop = args[0].getPropertyName(),
        val = args[1].getValue();
    this.query.where(prop).equals(new RegExp(this.regexEscape(val)));
};

MongooseVisitor.prototype.eq = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).equals(expr.getRHS().getValue());
};
MongooseVisitor.prototype.ne = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).ne(expr.getRHS().getValue());
};

MongooseVisitor.prototype.gt = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).gt(expr.getRHS().getValue());
};
MongooseVisitor.prototype.lt = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).lt(expr.getRHS().getValue());
};

MongooseVisitor.prototype.ge = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).gte(expr.getRHS().getValue());
};
MongooseVisitor.prototype.le = function(expr) {
    this.query.where(expr.getLHS().getPropertyName()).lte(expr.getRHS().getValue());
};

MongooseVisitor.prototype.and = function(binary) {}; // initially not supporting or so and is just a formality
MongooseVisitor.prototype.string_lit = function(lit) {};
MongooseVisitor.prototype.number_lit = function(lit) {};
MongooseVisitor.prototype.boolean_lit = function(lit) {};
MongooseVisitor.prototype.property = function(prop) {};

module.exports = function(query,filter) {
    (new OdataExpressionParser()).parse(filter).visit(new MongooseVisitor(query));
};
/*
var visitor = new MongooseVisitor(),
    parser = new OdataExpressionParser(),
    bce = parser.parse('name eq \'Bob\' and stars ne 2');
bce.visit(visitor);*/
