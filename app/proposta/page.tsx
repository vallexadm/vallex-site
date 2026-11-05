import type {Metadata} from "next";
import ProposalClient from "./proposal-client";
export const metadata:Metadata={title:"Proposta de serviço | VALLEX",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <ProposalClient/>;}
