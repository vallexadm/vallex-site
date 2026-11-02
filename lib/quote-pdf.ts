import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
type QuotePdfData={provider:{name:string;taxId?:string;address?:string;email?:string;phone?:string};customer:string;title:string;description:string|null;amount:number;validUntil:string|null;notes:string|null;status:string};
const safe=(value:string)=>value.normalize("NFC").replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g," ");
export async function generateQuotePdf(data:QuotePdfData) {
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Orçamento - ${safe(data.title)}`);doc.setAuthor(safe(data.provider.name));
  let page=doc.addPage([595,842]),y=790;
  function line(text:string,size=11,strong=false){
    const face=strong?bold:font;
    for(const paragraph of safe(text).slice(0,12000).split("\n")){
      const words=paragraph.split(/\s+/).flatMap(word=>word.match(/.{1,60}/g)||[""]);let row="";
      for(const word of [...words,""]){
        const next=row?`${row} ${word}`:word;
        if(row&&(face.widthOfTextAtSize(next,size)>490||!word)){
          if(y<65){page=doc.addPage([595,842]);y=790;}
          page.drawText(row,{x:50,y,size,font:face,color:rgb(.16,.10,.22)});y-=size+6;row=word;
        }else row=next;
      }
    }
    y-=7;
  }
  line("ORÇAMENTO",22,true);line(data.provider.name,16,true);
  for(const value of [data.provider.taxId?`CPF/CNPJ: ${data.provider.taxId}`:"",data.provider.address,data.provider.email,data.provider.phone])if(value)line(value,10);
  line(`Cliente: ${data.customer}`);line(`Proposta: ${data.title}`,14,true);
  line(`Situação: ${data.status}`);if(data.validUntil)line(`Validade: ${data.validUntil.split('-').reverse().join('/')}`);
  if(data.description){line("Serviço proposto",12,true);line(data.description);}
  line(`Valor total: ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(data.amount)}`,16,true);
  if(data.notes){line("Condições e observações",12,true);line(data.notes);}
  line("Documento comercial. Este orçamento não é uma nota fiscal.",9);
  for(const [index,p] of doc.getPages().entries())p.drawText(`ServiçoFácil | Página ${index+1} de ${doc.getPageCount()}`,{x:50,y:30,size:9,font,color:rgb(.4,.35,.45)});
  return doc.save();
}
