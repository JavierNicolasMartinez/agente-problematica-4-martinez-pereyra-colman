/** Error controlado de la API: tiene código HTTP y un mensaje seguro para el cliente. */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}
