export default function AvisoPrototipo() {
  return (
    <footer className="nao-imprimir mx-auto max-w-6xl px-4 pb-8 pt-2 text-xs text-tinta/50 sm:px-6">
      <p>
        <strong className="font-semibold text-tinta/60">Protótipo local (V1).</strong> Os dados ficam num arquivo no
        servidor onde este app roda. Quem acessa a mesma instalação vê os mesmos dados; instalações separadas não
        compartilham informação. Esse arquivo não persiste num deploy do Vercel: antes de publicar com dados pessoais
        reais, falta ligar um banco de dados hospedado.
      </p>
    </footer>
  );
}
