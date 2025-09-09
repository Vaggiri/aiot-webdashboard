import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { FiActivity, FiDroplet, FiThermometer, FiMapPin, FiClock, FiTrendingUp } from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
  const [sensorData, setSensorData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchData();
    // Set up interval to fetch data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://gas-value-33f5a-default-rtdb.firebaseio.com/SensorData.json');
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      setSensorData(data);
      
      // Add to historical data for charts
      setHistoricalData(prev => {
        const newData = [...prev, {
          ...data,
          timestamp: new Date(data.timestamp).toLocaleTimeString(),
          fullDate: new Date(data.timestamp)
        }];
        
        // Keep only the last 24 readings
        return newData.slice(-24);
      });
      
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching sensor data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate predictions based on current data trends
  const generatePredictions = () => {
    if (historicalData.length < 2) return null;
    
    const latest = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];
    
    // Simple linear extrapolation for demonstration
    const tempTrend = latest.temperature > previous.temperature ? 'rising' : 'falling';
    const humidityTrend = latest.humidity > previous.humidity ? 'rising' : 'falling';
    const carbonTrend = latest.carbon > previous.carbon ? 'rising' : 'falling';
    
    return {
      temperature: {
        trend: tempTrend,
        message: tempTrend === 'rising' 
          ? 'Temperature is increasing. Consider ventilation if this continues.' 
          : 'Temperature is decreasing. Normal range expected.'
      },
      humidity: {
        trend: humidityTrend,
        message: humidityTrend === 'rising' 
          ? 'Humidity increasing. Monitor for condensation issues.' 
          : 'Humidity decreasing. Optimal for most environments.'
      },
      carbon: {
        trend: carbonTrend,
        message: carbonTrend === 'rising' 
          ? 'Carbon levels rising. Ensure proper ventilation.' 
          : 'Carbon levels decreasing. Air quality improving.'
      }
    };
  };

  const predictions = generatePredictions();

  // Data for charts
  const chartData = historicalData.map(item => ({
    name: item.timestamp,
    temperature: item.temperature,
    humidity: item.humidity,
    carbon: item.carbon
  }));

  // Data for gauge charts
  const carbonGaugeData = [
    { name: 'Optimal', value: 400 },
    { name: 'Current', value: sensorData ? sensorData.carbon - 400 : 0 },
    { name: 'Remaining', value: 1000 - (sensorData ? sensorData.carbon : 0) }
  ];

  const COLORS = ['#0088FE', '#FF8042', '#00C49F'];

  if (loading && !sensorData) {
    return (
      <div className="dashboard-loading">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="loading-spinner"
        />
        <p>Loading sensor data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Environment Monitoring Dashboard
        </motion.h1>
        <div className="last-updated">
          <FiClock />
          <span>Last updated: {sensorData.timestamp}</span>
        </div>
      </header>

      <nav className="dashboard-nav">
        {['overview', 'temperature', 'humidity', 'carbon', 'predictions'].map(tab => (
          <button
            key={tab}
            className={selectedTab === tab ? 'active' : ''}
            onClick={() => setSelectedTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="dashboard-content"
        >
          {selectedTab === 'overview' && (
            <div className="overview-grid">
              <motion.div 
                className="data-card"
                whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
              >
                <div className="card-header">
                  <FiThermometer />
                  <h3>Temperature</h3>
                </div>
                <div className="card-value">{sensorData.temperature}°C</div>
                <div className="card-status">
                  {sensorData.temperature > 30 ? 'High' : 'Normal'}
                </div>
              </motion.div>

              <motion.div 
                className="data-card"
                whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
              >
                <div className="card-header">
                  <FiDroplet />
                  <h3>Humidity</h3>
                </div>
                <div className="card-value">{sensorData.humidity}%</div>
                <div className="card-status">
                  {sensorData.humidity > 60 ? 'High' : 'Optimal'}
                </div>
              </motion.div>

              <motion.div 
                className="data-card"
                whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
              >
                <div className="card-header">
                  <FiActivity />
                  <h3>Carbon</h3>
                </div>
                <div className="card-value">{sensorData.carbon} ppm</div>
                <div className="card-status">
                  {sensorData.carbon > 450 ? 'Elevated' : 'Normal'}
                </div>
              </motion.div>

              <motion.div 
                className="data-card"
                whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
              >
                <div className="card-header">
                  <FiMapPin />
                  <h3>Location</h3>
                </div>
                <div className="card-value">{sensorData.location}</div>
                <div className="card-status">GPS Coordinates</div>
              </motion.div>

              <div className="chart-card full-width">
                <h3>Trend Overview</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="temperature" stackId="1" stroke="#ff7300" fill="#ff7300" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="humidity" stackId="2" stroke="#387908" fill="#387908" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="carbon" stackId="3" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Carbon Levels</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={carbonGaugeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {carbonGaugeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="gauge-label">
                  Current: {sensorData.carbon} ppm
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'temperature' && (
            <div className="detail-view">
              <h2>Temperature Monitoring</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="temperature" stroke="#ff7300" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="data-insights">
                <h3>Insights</h3>
                <p>Current temperature is {sensorData.temperature}°C which is 
                  {sensorData.temperature > 30 ? ' above' : ' within'} the optimal range.</p>
                {predictions && (
                  <div className={`prediction ${predictions.temperature.trend}`}>
                    <FiTrendingUp />
                    <span>{predictions.temperature.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'humidity' && (
            <div className="detail-view">
              <h2>Humidity Monitoring</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="humidity" stroke="#387908" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="data-insights">
                <h3>Insights</h3>
                <p>Current humidity level is {sensorData.humidity}% which is 
                  {sensorData.humidity > 60 ? ' above' : ' within'} the optimal range.</p>
                {predictions && (
                  <div className={`prediction ${predictions.humidity.trend}`}>
                    <FiTrendingUp />
                    <span>{predictions.humidity.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'carbon' && (
            <div className="detail-view">
              <h2>Carbon Levels Monitoring</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="carbon" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="data-insights">
                <h3>Insights</h3>
                <p>Current carbon level is {sensorData.carbon} ppm which is 
                  {sensorData.carbon > 450 ? ' above' : ' within'} the optimal range.</p>
                {predictions && (
                  <div className={`prediction ${predictions.carbon.trend}`}>
                    <FiTrendingUp />
                    <span>{predictions.carbon.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'predictions' && (
            <div className="predictions-view">
              <h2>Predictive Analysis & Suggestions</h2>
              
              {predictions ? (
                <div className="predictions-grid">
                  <motion.div 
                    className="prediction-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <h3>Temperature</h3>
                    <div className={`trend-indicator ${predictions.temperature.trend}`}>
                      {predictions.temperature.trend.toUpperCase()}
                    </div>
                    <p>{predictions.temperature.message}</p>
                    <div className="suggestion">
                      {predictions.temperature.trend === 'rising' 
                        ? 'Suggestion: Increase ventilation or activate cooling systems'
                        : 'Suggestion: Maintain current environmental controls'}
                    </div>
                  </motion.div>

                  <motion.div 
                    className="prediction-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <h3>Humidity</h3>
                    <div className={`trend-indicator ${predictions.humidity.trend}`}>
                      {predictions.humidity.trend.toUpperCase()}
                    </div>
                    <p>{predictions.humidity.message}</p>
                    <div className="suggestion">
                      {predictions.humidity.trend === 'rising' 
                        ? 'Suggestion: Consider using dehumidifiers if humidity exceeds 65%'
                        : 'Suggestion: Current humidity levels are optimal for most applications'}
                    </div>
                  </motion.div>

                  <motion.div 
                    className="prediction-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <h3>Carbon Levels</h3>
                    <div className={`trend-indicator ${predictions.carbon.trend}`}>
                      {predictions.carbon.trend.toUpperCase()}
                    </div>
                    <p>{predictions.carbon.message}</p>
                    <div className="suggestion">
                      {predictions.carbon.trend === 'rising' 
                        ? 'Suggestion: Improve ventilation immediately. Consider air purifiers if levels continue to rise'
                        : 'Suggestion: Air quality is improving. Maintain current ventilation'}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <p>Insufficient data for predictions. Please wait for more data points.</p>
              )}

              <div className="recommendations">
                <h3>General Recommendations</h3>
                <ul>
                  <li>Maintain temperature between 20-30°C for optimal comfort</li>
                  <li>Keep humidity levels between 40-60% to prevent mold growth and discomfort</li>
                  <li>Ensure carbon levels remain below 450 ppm for good air quality</li>
                  <li>Regularly ventilate the space to maintain fresh air circulation</li>
                  <li>Monitor trends over time to identify patterns and potential issues</li>
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;