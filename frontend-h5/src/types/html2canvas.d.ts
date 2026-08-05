declare module 'html2canvas' {
  interface Options {
    scale?: number
    useCORS?: boolean
    allowTaint?: boolean
    backgroundColor?: string
    logging?: boolean
    onclone?: (document: Document) => void
  }
  
  function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement>
  export default html2canvas
}

declare module 'jspdf' {
  export class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string)
    internal: {
      pageSize: {
        getWidth(): number
        getHeight(): number
      }
    }
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void
    save(filename: string): void
  }
}
