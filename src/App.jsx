import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Row,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Tooltip as AntTooltip,
  message,
} from "antd";
import {
  CloudFilled,
  DeleteOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "antd/dist/reset.css";

const EARTH_IMAGE =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_IMAGE =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";
const SKY_IMAGE =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png";

// กราฟ AreaChart ไล่เฉดสี
function GradientAreaChart({ title, data, dataKey, color, gradientId, unit }) {
  return (
    <div style={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={290}>
        <AreaChart
          data={data}
          margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.45} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="displayTime"
            minTickGap={30}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            width={60}
            unit={unit}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f8fafc",
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime ?? ""}
            formatter={(value) => [`${value} ${unit}`, title]}
          />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={title}
            stroke={color}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 6, fill: color, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function App() {
  const globeRef = useRef(null);
  const requestControllerRef = useRef(null);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [weatherData, setWeatherData] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ระบบเมืองโปรด (Favorite Locations)
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("weather_favorites");
    return saved
      ? JSON.parse(saved)
      : [
          { name: "กรุงเทพฯ", lat: 13.7563, lng: 100.5018 },
          { name: "โตเกียว", lat: 35.6762, lng: 139.6503 },
          { name: "ลอนดอน", lat: 51.5074, lng: -0.1278 },
        ];
  });

  const [units, setUnits] = useState({
    temperature: "°C",
    humidity: "%",
    windSpeed: "km/h",
    precipitationProbability: "%",
  });

  useEffect(() => {
    localStorage.setItem("weather_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      requestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 13.75, lng: 100.5, altitude: 2.2 }, 1000);
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableDamping = true;
    }
  }, []);

  const fetchWeather = async (latitude, longitude) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setLoading(true);
    setError("");
    setWeatherData([]);

    try {
      const parameters = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly:
          "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability",
        forecast_days: "2",
        timezone: "auto",
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${parameters}`,
        { signal: controller.signal }
      );

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();
      const hourly = result.hourly;

      if (!hourly?.time) throw new Error("ไม่พบข้อมูลเวลาพยากรณ์");

      const formattedData = hourly.time.map((time, index) => ({
        time,
        displayTime: time.slice(5).replace("T", " "),
        fullTime: time.replace("T", " "),
        temperature: hourly.temperature_2m?.[index] ?? 0,
        humidity: hourly.relative_humidity_2m?.[index] ?? 0,
        windSpeed: hourly.wind_speed_10m?.[index] ?? 0,
        precipitationProbability: hourly.precipitation_probability?.[index] ?? 0,
      }));

      setWeatherData(formattedData);
      setUnits({
        temperature: result.hourly_units?.temperature_2m ?? "°C",
        humidity: result.hourly_units?.relative_humidity_2m ?? "%",
        windSpeed: result.hourly_units?.wind_speed_10m ?? "km/h",
        precipitationProbability:
          result.hourly_units?.precipitation_probability ?? "%",
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Fetch error:", err);
        setError(err.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const inspectLocation = (location) => {
    setSelectedLocation(location);
    setModalOpen(true);

    if (globeRef.current) {
      globeRef.current.controls().autoRotate = false;
      globeRef.current.pointOfView(
        { lat: location.lat, lng: location.lng, altitude: 1.8 },
        800
      );
    }
    fetchWeather(location.lat, location.lng);
  };

  const handleGlobeClick = ({ lat, lng }) => {
    const location = {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      name: `พิกัด (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
    };
    inspectLocation(location);
  };

  const handleCloseModal = () => {
    requestControllerRef.current?.abort();
    setModalOpen(false);
    setLoading(false);
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
    }
  };

  const isCurrentFavorite = favorites.some(
    (item) =>
      Math.abs(item.lat - (selectedLocation?.lat ?? 0)) < 0.05 &&
      Math.abs(item.lng - (selectedLocation?.lng ?? 0)) < 0.05
  );

  const toggleFavorite = () => {
    if (!selectedLocation) return;
    if (isCurrentFavorite) {
      setFavorites(
        favorites.filter(
          (item) =>
            Math.abs(item.lat - selectedLocation.lat) >= 0.05 ||
            Math.abs(item.lng - selectedLocation.lng) >= 0.05
        )
      );
      message.info("ลบออกจากเมืองโปรดแล้ว");
    } else {
      setFavorites([
        ...favorites,
        {
          name: selectedLocation.name || `พิกัด (${selectedLocation.lat}, ${selectedLocation.lng})`,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        },
      ]);
      message.success("เพิ่มลงในรายการเมืองโปรดแล้ว");
    }
  };

  // ตรวจสอบการแจ้งเตือนสภาพอากาศ (Weather Alerts)
  const currentSnapshot = weatherData[0] || null;
  const weatherAlerts = [];
  if (currentSnapshot) {
    if (currentSnapshot.precipitationProbability >= 50) {
      weatherAlerts.push({
        type: "warning",
        text: `โอกาสฝนตกสูง (${currentSnapshot.precipitationProbability}%) ควรพกร่มหรือเตรียมรับมือฝนตก`,
      });
    }
    if (currentSnapshot.temperature >= 38) {
      weatherAlerts.push({
        type: "error",
        text: `สภาพอากาศร้อนจัด (${currentSnapshot.temperature}°C) หลีกเลี่ยงแสงแดดจัดกลางแจ้ง`,
      });
    }
    if (currentSnapshot.windSpeed >= 35) {
      weatherAlerts.push({
        type: "warning",
        text: `กระแสลมแรง (${currentSnapshot.windSpeed} km/h) ระมัดระวังพายุหรือลมกรรโชก`,
      });
    }
  }

  const activePoints = [
    ...(selectedLocation ? [{ ...selectedLocation, color: "#00f0ff", size: 0.6 }] : []),
    ...favorites.map((fav) => ({
      ...fav,
      color: "#ff007f",
      size: 0.35,
    })),
  ];

  const tabItems = [
    {
      key: "temp",
      label: "🌡️ อุณหภูมิ",
      children: (
        <GradientAreaChart
          title="อุณหภูมิ"
          data={weatherData}
          dataKey="temperature"
          color="#f43f5e"
          gradientId="tempGrad"
          unit={units.temperature}
        />
      ),
    },
    {
      key: "rain",
      label: "🌧️ โอกาสเกิดฝน",
      children: (
        <GradientAreaChart
          title="โอกาสฝนตก"
          data={weatherData}
          dataKey="precipitationProbability"
          color="#818cf8"
          gradientId="rainGrad"
          unit={units.precipitationProbability}
        />
      ),
    },
    {
      key: "humidity",
      label: "💧 ความชื้น",
      children: (
        <GradientAreaChart
          title="ความชื้นสัมพัทธ์"
          data={weatherData}
          dataKey="humidity"
          color="#38bdf8"
          gradientId="humidGrad"
          unit={units.humidity}
        />
      ),
    },
    {
      key: "wind",
      label: "💨 ความเร็วลม",
      children: (
        <GradientAreaChart
          title="ความเร็วลม"
          data={weatherData}
          dataKey="windSpeed"
          color="#34d399"
          gradientId="windGrad"
          unit={units.windSpeed}
        />
      ),
    },
  ];

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.floatingHeader}>
        <div style={styles.glassHeader}>
          <h1 style={styles.headerTitle}>EARTH WEATHER RADAR HUD</h1>
          <p style={styles.headerSubtitle}>
            คลิกบนลูกโลกเพื่อสแกนสภาพอากาศ หรือเลือกเมืองโปรดจากแผงควบคุม
          </p>
        </div>
      </header>

      {/* แผงควบคุมเมืองโปรด (Favorites Drawer Panel) */}
      <aside style={styles.favoritesPanel}>
        <div style={styles.favHeader}>
          <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: 13 }}>
            ⭐ เมืองโปรดที่บันทึกไว้ ({favorites.length})
          </span>
        </div>
        <div style={styles.favList}>
          {favorites.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: "#94a3b8", fontSize: 11 }}>ยังไม่มีเมืองโปรด</span>}
            />
          ) : (
            favorites.map((item, idx) => (
              <div
                key={idx}
                style={styles.favItem}
                onClick={() => inspectLocation(item)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <EnvironmentOutlined style={{ color: "#ff007f", fontSize: 12 }} />
                  <span style={styles.favItemName}>{item.name}</span>
                </div>
                <AntTooltip title="ลบออก">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined style={{ color: "#64748b" }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFavorites(favorites.filter((_, i) => i !== idx));
                      message.info(`ลบ ${item.name} แล้ว`);
                    }}
                  />
                </AntTooltip>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ลูกโลก 3D */}
      <div style={styles.globeContainer}>
        <Globe
          ref={globeRef}
          width={windowSize.width}
          height={windowSize.height}
          globeImageUrl={EARTH_IMAGE}
          bumpImageUrl={EARTH_BUMP_IMAGE}
          backgroundImageUrl={SKY_IMAGE}
          showAtmosphere
          atmosphereColor="#00d2ff"
          atmosphereAltitude={0.2}
          pointsData={activePoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d) => d.color}
          pointAltitude={0.05}
          pointRadius={(d) => d.size}
          ringsData={selectedLocation ? [selectedLocation] : []}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => "#00f0ff"}
          ringMaxRadius={5}
          ringPropagationSpeed={3}
          ringRepeatPeriod={1000}
          onGlobeClick={handleGlobeClick}
        />
      </div>

      {/* Modal Popup แสดงผลสภาพอากาศ */}
      <Modal
        open={modalOpen}
        onCancel={handleCloseModal}
        footer={null}
        centered
        width={920}
        destroyOnHidden
        styles={{
          content: {
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            backdropFilter: "blur(16px)",
            borderRadius: "16px",
            color: "#fff",
          },
          header: {
            background: "transparent",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          },
        }}
        title={
          <div style={styles.modalHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={styles.modalTitle}>SENSOR STATION TELEMETRY</span>
              <Button
                type="text"
                icon={
                  isCurrentFavorite ? (
                    <HeartFilled style={{ color: "#ff007f", fontSize: 18 }} />
                  ) : (
                    <HeartOutlined style={{ color: "#94a3b8", fontSize: 18 }} />
                  )
                }
                onClick={toggleFavorite}
              >
                <span style={{ color: isCurrentFavorite ? "#ff007f" : "#94a3b8" }}>
                  {isCurrentFavorite ? "บันทึกแล้ว" : "เพิ่มในเมืองโปรด"}
                </span>
              </Button>
            </div>
            {selectedLocation && (
              <Tag color="cyan">
                LAT: {selectedLocation.lat}° | LNG: {selectedLocation.lng}°
              </Tag>
            )}
          </div>
        }
      >
        {loading && (
          <div style={styles.centerBox}>
            <Spin size="large" />
            <span style={{ color: "#94a3b8", marginTop: 12 }}>
              กำลังเชื่อมต่อดาวเทียมและสถานีพยากรณ์อากาศ...
            </span>
          </div>
        )}

        {error && (
          <Alert
            type="error"
            showIcon
            message="การดึงข้อมูลขัดข้อง"
            description={error}
            style={{ margin: "16px 0" }}
          />
        )}

        {!loading && !error && weatherData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {/* กล่องเตือนสภาพอากาศ (Alerts) */}
            {weatherAlerts.map((alertItem, idx) => (
              <Alert
                key={idx}
                type={alertItem.type}
                showIcon
                icon={<WarningOutlined />}
                message={alertItem.text}
                style={{ marginBottom: 12 }}
              />
            ))}

            {/* Quick Stats Banner */}
            {currentSnapshot && (
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card style={styles.statCard} bodyStyle={{ padding: 10 }}>
                    <Statistic
                      title={<span style={styles.statTitle}>อุณหภูมิ</span>}
                      value={currentSnapshot.temperature}
                      suffix={units.temperature}
                      valueStyle={{ color: "#f43f5e", fontWeight: "bold", fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={styles.statCard} bodyStyle={{ padding: 10 }}>
                    <Statistic
                      title={<span style={styles.statTitle}>โอกาสฝน</span>}
                      value={currentSnapshot.precipitationProbability}
                      suffix={units.precipitationProbability}
                      valueStyle={{ color: "#818cf8", fontWeight: "bold", fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={styles.statCard} bodyStyle={{ padding: 10 }}>
                    <Statistic
                      title={<span style={styles.statTitle}>ความชื้น</span>}
                      value={currentSnapshot.humidity}
                      suffix={units.humidity}
                      valueStyle={{ color: "#38bdf8", fontWeight: "bold", fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={styles.statCard} bodyStyle={{ padding: 10 }}>
                    <Statistic
                      title={<span style={styles.statTitle}>ความเร็วลม</span>}
                      value={currentSnapshot.windSpeed}
                      suffix={units.windSpeed}
                      valueStyle={{ color: "#34d399", fontWeight: "bold", fontSize: 20 }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            <Tabs defaultActiveKey="temp" items={tabItems} />
          </div>
        )}
      </Modal>
    </main>
  );
}

const styles = {
  page: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    margin: 0,
    overflow: "hidden",
    background: "#020617",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  floatingHeader: {
    position: "absolute",
    zIndex: 10,
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  glassHeader: {
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(12px)",
    padding: "10px 28px",
    borderRadius: "30px",
    textAlign: "center",
  },
  headerTitle: {
    margin: 0,
    fontSize: "17px",
    letterSpacing: "2px",
    color: "#38bdf8",
    fontWeight: 700,
  },
  headerSubtitle: {
    margin: 0,
    fontSize: "12px",
    color: "#94a3b8",
  },
  favoritesPanel: {
    position: "absolute",
    zIndex: 10,
    top: 20,
    left: 20,
    width: 240,
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(12px)",
    borderRadius: 14,
    padding: 12,
  },
  favHeader: {
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  favList: {
    maxHeight: 220,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  favItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    borderRadius: 8,
    background: "rgba(30, 41, 59, 0.5)",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  favItemName: {
    color: "#e2e8f0",
    fontSize: 12,
    maxWidth: 120,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  globeContainer: {
    position: "absolute",
    inset: 0,
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingRight: 24,
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: "15px",
    letterSpacing: "1px",
    fontWeight: "bold",
  },
  centerBox: {
    minHeight: 250,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  statCard: {
    background: "rgba(30, 41, 59, 0.7)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
  },
  statTitle: {
    color: "#94a3b8",
    fontSize: "11px",
  },
  chartWrapper: {
    background: "rgba(30, 41, 59, 0.4)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    padding: "14px",
    borderRadius: "12px",
    marginTop: 6,
  },
};

export default App;