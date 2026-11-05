import EscenaValhalla from '../componentes/EscenaValhalla.jsx';
import guerreros from '../assets/guerreros-valhalla.webp';

export default function Valhalla() {
  return (
    <section className="valhalla" aria-labelledby="titulo-valhalla">
      <EscenaValhalla />
      <header className="valhalla-cabeza">
        <p className="runas" aria-hidden="true">ᚹᚨᛚᚺᚨᛚᛚᚨ</p>
        <h1 id="titulo-valhalla">Valhalla</h1>
        <p>Gracias, profesores Dante y Gabriel, por guiarnos en esta travesía. ¡Skål!</p>
      </header>
      <img
        className="valhalla-guerreros"
        src={guerreros}
        width="1086"
        height="1181"
        alt="Tres guerreros vikingos con capas de piel, cinturones de cuero y un casco con cuernos, posando con gesto feroz en el salón del Valhalla."
      />
    </section>
  );
}
