# Forja & Temple — Quiz de Enfriamiento

**Autores:** Alejandro Piedrahita · Daniel Colorado · Sebastián Patiño

Laboratorio virtual (HTML + CSS + JS puro, sin internet ni instalación) basado
en la **Ley de Enfriamiento de Newton**. Tres experimentos corren en paralelo:
en cada uno se elige el **metal**, el **medio** (aire, aceite, agua,
salmuera, nitrógeno líquido, horno, …) y las temperaturas. El simulador
calcula la constante *k* a partir de **propiedades físicas reales**, anima
cómo la pieza **pierde o gana calor** y desarrolla toda la matemática paso a
paso con los números del momento.

## Cómo abrirlo

Doble clic en `index.html` (Chrome, Edge o Firefox). Funciona sin conexión.

## Modelo físico

Balance de energía de la pieza (modelo de capacidad concentrada):

```
m·c·dT/dt = −h·A·(T − Tm)   ⇒   dT/dt = −k (T − Tm),   k = hA/(ρ·c·V)
T(t) = Tm + (T0 − Tm)·e^(−k t)
```

- ρ, c, k_metal: tabla del metal (Incropera, Tabla A.1, 300 K).
- h: coeficiente de convección del medio (valor representativo, editable).
- A, V: área y volumen del cilindro (diámetro D y largo L, editables).

El tiempo es **real** (segundos). La velocidad automática funciona como un
*time-lapse*: arranca lento para que se vean los medios rápidos (agua) y
acelera para los lentos (aire).

## Qué incluye

1. **Escenarios listos**: temple clásico, duelo de metales, polímero vs agua
   vs salmuera, ganar calor en horno y criogenia con nitrógeno líquido.
2. **Datos digitables**: metal (11 de tabla + uno personalizado), medio (9 +
   uno personalizado), T₀, temperatura del medio, h, diámetro y largo.
3. **Validación física**: no deja simular un metal por encima de su punto
   de fusión (por ejemplo, aluminio a 900 °C) ni temperaturas bajo el cero
   absoluto.
4. **Escenas animadas**: color real de incandescencia (desde 525 °C, punto
   de Draper), capa de vapor (Leidenfrost), ebullición nucleada, convección,
   humo del aceite, niebla del nitrógeno, escarcha, ventilador y horno de
   ladrillo. Flechas **rojas** = calor que sale, **doradas** = calor que
   entra; su grosor y rapidez dependen de la potencia térmica.
5. **Gradiente interno**: si Biot > 0.1 la pieza se dibuja con el núcleo más
   caliente que la superficie (solución de un término del cilindro).
6. **Vista de cámara térmica** (paleta *ironbow*).
7. **Gráfica T(t)** en vivo (escala lineal o logarítmica) con mediciones y
   líneas de referencia.
8. **Gráfica de potencia**: el área sombreada bajo q(t) es la energía
   Q = ∫q dt, y crece en vivo.
9. **Matemática paso a paso** (10 pasos): modelo, cálculo de k desde las
   propiedades, separación de variables, integral definida, despeje,
   evaluación numérica, primera y segunda derivada, integral de energía,
   tiempo para llegar a una temperatura objetivo y número de Biot.
10. **Análisis tipo informe**: tabla con ΔT/Δt, T − Tₘ, razón y ln|T − Tₘ|.
    Calcula k de tres formas (promedio de razones como en el informe,
    logaritmo por intervalo y regresión lineal con R²) y explica el sesgo
    del método de razones.
11. **Modo laboratorio**: agrega ruido de sensor a las mediciones.
12. **Tablas de propiedades** de metales y medios, marcando cuáles se usan.
13. **Exportación**: tablas a CSV y gráfica a PNG.

## Límites del modelo (también se muestran en la página)

- Solo es exacto si Biot = h·Lc/k_metal < 0.1.
- En un temple real h no es constante: pasa por capa de vapor, ebullición y
  convección. El simulador anima esas etapas, pero usa un h promedio.
- A alta temperatura en aire, la radiación (≈ 100 W/m²·K a 900 °C) supera a
  la convección natural y no está incluida.
- Las propiedades del metal se toman a 300 K. El medio se considera infinito
  (su temperatura no cambia). No se modela el calor latente de la
  transformación austenita → martensita.

## Estructura

```
Termografo/
├── index.html   → estructura de la página
├── style.css    → estilos y animaciones
├── data.js      → tablas de metales, medios y escenarios
├── script.js    → física, animación, gráficas, matemática y análisis
└── README.md
```
