import type {Metadata} from "next";
import ReviewClient from "./review-client";
export const metadata:Metadata={title:"Avaliar atendimento | ServiçoFácil",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <ReviewClient/>;}
