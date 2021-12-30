import logo from './logo.svg';
import './App.css';
import Display from './Components/Display.js'
import ReactGA from 'react-ga';

ReactGA.initialize('UA-202974891-1')
ReactGA.pageview(window.location.pathname + window.location.search)

function App() {
  return (
    <div className="App">
      <Display/>
    </div>
  );
}

export default App;
