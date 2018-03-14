import { Model, DocumentQuery, Document } from 'mongoose';
import { Request, Response, Router } from 'express';

export = Resource;

declare class Resource<DocType extends Document> {
    constructor(def:Resource.ResourceDef<DocType>);
    getDefinition():Resource.ResourceDef<DocType>;
    getRel():string;
    getModel():Model<DocType>;
    getInstanceLinkNames():string[];
    getStaticLinkNames():string[];
    singleResponse(req:Request,res:Response,obj:any,postMapper?:Resource.POST_MAPPER,next?:Resource.NEXT):void;
    _findListResponse(req:Request,res:Response,objs:any[],postMapper?:Resource.POST_MAPPER,next?:Resource.NEXT):void;
    listResponse(req:Request,res:Response,objs:any[],postMapper?:Resource.POST_MAPPER,next?:Resource.NEXT):void;
    relListResponse(req:Request,res:Response,objs:any[],postMapper?:Resource.POST_MAPPER,next?:Resource.NEXT):void;

    initQuery(query:DocumentQuery<DocType[],DocType>,req:Request):DocumentQuery<DocType[],DocType>;

    getMapper(postMapper?:Resource.POST_MAPPER):Resource.POST_MAPPER;

    findById(req:Request,res:Response,next?:Resource.NEXT):void;
    find(req:Request,res:Response,next?:Resource.NEXT):void;
    count(req:Request,res:Response,next?:Resource.NEXT):void;
    create(req:Request,res:Response,next?:Resource.NEXT):void;
    update(req:Request,res:Response,next?:Resource.NEXT):void;
    delete(req:Request,res:Response,next?:Resource.NEXT):void;

    staticLink(rel:string,link:Resource.LINK_FUNC | Resource.LinkDef):Resource<DocType>;
    instanceLink(rel:string,link:Resource.LINK_FUNC | Resource.LinkDef):Resource<DocType>;

    initRouter(app:any):Router;

    static sendError(res:Response,rc:number,message:string,err?:any):void;
    static parseFilter(query:DocumentQuery<any,any>,filter:string):void;
}

declare namespace Resource {
    export interface LinkDef {
        otherSide: Resource<any>;
        key: string;
    }

    type POST_MAPPER = (o:any,index?:number,array?:any[]) => any;
    type NEXT = (err?:any,o?:any) => void;
    type LINK_FUNC = (req:Request,res:Response) => void;

    export interface ResourceDef<DocType extends Document> {
        model: Model<DocType>;
        rel: string;
        create?:boolean;
        update?:boolean;
        delete?:boolean;
        lean?:boolean;
        populate?: string | string[];
        count?:boolean;

        $top?:number;
        $skip?:number;
        $orderby?:string;
        $orderbyPaged?:string;
        $select?:string;
    }
}
