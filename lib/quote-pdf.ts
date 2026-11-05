import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
type QuotePdfData = {provider:{name:string;taxId?:string;address?:string;email?:string;phone?:string};customer:string;customerPhone?:string;customerAddress?:string;title:string;description:string|null;amount:number;validUntil:string|null;notes:string|null;status:string};
const safe=(v:string)=>v.normalize("NFC").replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g," ");
export async function generateQuotePdf(data:QuotePdfData){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle(`Proposta - ${safe(data.title)}`);doc.setAuthor(safe(data.provider.name));
 const purple=rgb(.32,.08,.52),pale=rgb(.95,.92,.98),ink=rgb(.13,.16,.21),border=rgb(.75,.77,.81);
 let page=doc.addPage([595,842]),y=794;
 const text=(v:string,x:number,at:number,size=10,strong=false)=>page.drawText(safe(v),{x,y:at,size,font:strong?bold:font,color:ink});
 function room(height:number){if(y-height<65){page=doc.addPage([595,842]);y=790;text(data.provider.name,40,y,12,true);y-=25;}}
 function wrap(v:string,width:number,size=10){const out:string[]=[];for(const p of safe(v).slice(0,12000).split('\n')){let row='';for(const word of p.split(/\s+/).flatMap(w=>w.match(/.{1,48}/g)||[''])){if(row&&font.widthOfTextAtSize(row+' '+word,size)>width){out.push(row);row=word;}else row+=(row?' ':'')+word;}out.push(row);}return out;}
 function lines(v:string,x=50,width=495,size=10){for(const row of wrap(v,width,size)){room(size+6);text(row,x,y,size);y-=size+6;}}
 function band(title:string){room(35);page.drawRectangle({x:40,y:y-8,width:515,height:23,color:pale,borderColor:border,borderWidth:.5});text(title,50,y,11,true);y-=29;}
 page.drawRectangle({x:40,y:737,width:62,height:62,color:purple});page.drawText('VALLEX',{x:46,y:766,size:11,font:bold,color:rgb(1,1,1)});page.drawText('ServicoFacil',{x:45,y:750,size:8,font,color:rgb(1,1,1)});
 y=785;for(const row of wrap(data.provider.name,420,16)){text(row,116,y,16,true);y-=20;}
 for(const v of [data.provider.taxId?`CPF/CNPJ: ${data.provider.taxId}`:'',data.provider.address,[data.provider.phone,data.provider.email].filter(Boolean).join(' | ')])if(v)lines(v,116,425,9);
 y=Math.min(y,715);band('PROPOSTA DE SERVIÇO');
 lines(`Cliente: ${data.customer}`);if(data.customerAddress)lines(`Endereço: ${data.customerAddress}`);if(data.customerPhone)lines(`Telefone: ${data.customerPhone}`);
 lines(`Emissão: ${new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}${data.validUntil?' | Validade: '+data.validUntil.split('-').reverse().join('/'):''}`);
 y-=8;band('SERVIÇOS E VALORES');
 const title=data.title.replace(/^orçamento\s*[-:–]?\s*/i,'');const rows=wrap(title,285,10),height=Math.max(47,rows.length*16+16);room(height+30);
 page.drawRectangle({x:40,y:y-5,width:515,height:21,color:pale,borderColor:border,borderWidth:.5});text('Qtd.',48,y+2,9,true);text('Descrição',92,y+2,9,true);text('Valor unitário',390,y+2,9,true);text('Total',486,y+2,9,true);y-=24;
 page.drawRectangle({x:40,y:y-height+13,width:515,height:height,borderColor:border,borderWidth:.5});text('1',50,y-3);rows.forEach((r,i)=>text(r,92,y-3-i*16));const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(data.amount);text(money,390,y-3,9);text(money,480,y-3,9);y-=height+9;
 room(43);page.drawRectangle({x:340,y:y-12,width:215,height:29,color:pale});text('TOTAL',350,y,11,true);text(money,450,y,12,true);y-=43;
 if(data.description){const parts=data.description.split(/Pedido do cliente:/i);band('ESCOPO DA PROPOSTA');lines(parts[0]);if(parts.length>1){y-=8;band('SOLICITAÇÃO ORIGINAL DO CLIENTE');lines(parts.slice(1).join('Pedido do cliente:'));}}
 if(data.notes){y-=8;band('CONDIÇÕES DE PAGAMENTO E OBSERVAÇÕES');lines(data.notes);}
 y-=8;lines('Documento comercial. Esta proposta não é uma nota fiscal.',50,495,9);
 for(const [i,p] of doc.getPages().entries())p.drawText(`ServiçoFácil | Página ${i+1} de ${doc.getPageCount()}`,{x:40,y:30,size:8,font,color:ink});return doc.save();
}
