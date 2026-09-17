import "../styles/globals.css"
import TokenMeter from "../components/TokenMeter"

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <TokenMeter />
    </>
  )
}
