# Cebali

Estimación del rendimiento de cebada de temporal y consulta visual de parcelas para el **Reto AgroCebada FIRA 2026**.

**Modelo incluido:** OCT_G5 1.5.0. El código de esta revisión y la aplicación publicada utilizan la misma receta. La identificación de la publicación está disponible en [`version.json`](https://cebali.pages.dev/version.json).

**Aplicación disponible:** [cebali.pages.dev](https://cebali.pages.dev/).

El proyecto trabaja con 197 parcelas de Hidalgo, Puebla y Tlaxcala: 138 cosechas conocidas y 59 parcelas del conjunto de predicción, del ciclo 2025. El modelo estima toneladas por hectárea; la aplicación calcula además la producción total aproximada a partir de la superficie.

Este repositorio reúne el **código fuente del modelo**, el **código fuente de la aplicación** y las instrucciones para ejecutarlos, conforme a los entregables tecnológicos de las [bases oficiales](https://www.fira.gob.mx/Nd/Reto%20Agrocebada%20Bases.pdf). El informe técnico, la bibliografía, los anexos y el video demostrativo son documentos de entrega separados; este README explica el funcionamiento y la reproducción del código.

## 1. Organización

```text
cebali/
├── README.md
├── .gitignore
├── modelo/
│   ├── ejecutar_por_etapas.R
│   ├── modelo_completo.R
│   ├── ejecucion.R
│   ├── etapas/                 # Nueve etapas del modelo final
│   ├── contratos/              # Orden de parcelas y particiones fijadas
│   ├── referencias/            # Comprobación posterior al cálculo
│   ├── resultados/             # Corrida reproducida y modelo guardado
│   ├── DEPENDENCIAS_VERIFICADAS.csv
│   ├── VERIFICACION_FINAL.json
│   └── SHA256.json
└── aplicacion/
    ├── src/
    │   ├── components/ui/      # Botón, tarjeta de datos y desplegable
    │   ├── styles/             # Estilos organizados por función
    │   ├── model/              # Inferencia TypeScript y parámetros
    │   ├── data/               # Catálogo, geometrías y mediciones preparadas
    │   └── reports/            # Generación de fichas PDF
    ├── public/                # Fuentes, marco e imágenes satelitales
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── vite.config.ts
    ├── eslint.config.js
    └── tsconfig*.json
```

No incluye modelos descartados, carpetas históricas, dependencias instaladas ni los TIFF originales. Toda la documentación del repositorio está reunida aquí; no hay otros archivos Markdown.

## 2. Consultar o ejecutar la aplicación

### Acceso directo

Abre [Cebali](https://cebali.pages.dev/). Permite explorar parcelas, calcular las 59 estimaciones, entender sus componentes, comparar mediciones, explorar escenarios de lluvia y descargar fichas PDF.

Las 138 parcelas conocidas muestran la cosecha oficial, identificada como observada. Para las 59 consultas, el botón **Estimar rendimiento** ejecuta el cálculo con parámetros congelados; no entrena nuevamente ni obtiene mediciones en tiempo real.

### Instalación local

Requiere **Node.js y npm**; versión de Node comprobada: **24.11.1**.
Desde la raíz del repositorio:

```sh
cd aplicacion
npm ci
npm run dev
```

Abre la dirección que muestre Vite. La aplicación no requiere R, servidor de modelos, base de datos, cuenta de mapas ni claves de API. Incluye las entradas preparadas y referencias necesarias para las 59 consultas oficiales.

### Compilar y comprobar

Desde `aplicacion/`:

```sh
npm test
npm run build
npm run lint
npm run preview
```

`npm test` compara la inferencia con 295 casos calculados en R, comprueba las 59 predicciones, las 138 cosechas observadas, 232 escenarios de lluvia y las 197 fichas PDF. También contrasta los 276 puntos de los gráficos de validación con los resultados reproducidos en `modelo/resultados/`. El motor no utiliza esas respuestas para predecir; las pruebas las consultan después del cálculo.

El motor, los datos de explicación, el simulador y las fichas verifican la identidad **OCT_G5 1.5.0** y su receta antes de utilizarlos. Las diferencias entre cifras mostradas se calculan con el mismo redondeo visible; la inferencia y la producción total conservan la precisión completa. El gráfico local muestra una repetición de 138 parcelas; sus métricas resumen las diez repeticiones.

Si se reproducen nuevamente las validaciones del mismo modelo y se desea sincronizar sus gráficos, ejecuta `npm run sync:validation` y después `npm test`. Este comando actualiza únicamente los resúmenes y puntos de validación de la interfaz; no cambia los parámetros ni las predicciones.

`build` comprueba TypeScript y genera `aplicacion/dist/`. `lint` revisa el código. `preview` permite consultar la compilación de producción localmente. Para publicar en Cloudflare Pages se sube **el contenido de `dist/`**, no el repositorio ni `node_modules/`.

En pantallas de escritorio se muestra un marco de teléfono con la aplicación dentro de un iframe; en pantallas pequeñas se presenta directamente la interfaz adaptable.

El botón **Ampliar lectura** permite aumentar la vista de escritorio conservando la consulta abierta. Predicciones incluye búsqueda por identificador o municipio y una lista para organizar la revisión por rendimiento estimado dentro de un municipio o estado. Esa lista ejecuta el mismo motor G5; su orden no diagnostica problemas agronómicos. Las cosechas conocidas tienen una sección **Origen del dato** que las identifica como valores oficiales, y las comparaciones indican cuántas cosechas conocidas se utilizan, excluyendo la propia cuando corresponde.

## 3. Reconstruir el modelo desde los datos oficiales

La carpeta `modelo/` procede del paquete aislado por etapas. No depende de Notion, scripts de experimentos anteriores ni rutas del workspace de investigación.

### Requisitos

Se comprobó con **R 4.6.1**. Las versiones directas verificadas están en [`modelo/DEPENDENCIAS_VERIFICADAS.csv`](modelo/DEPENDENCIAS_VERIFICADAS.csv), y el entorno completo en [`modelo/resultados/sessionInfo.txt`](modelo/resultados/sessionInfo.txt).

Instala una vez, desde R:

```r
install.packages(c("sf", "terra", "exactextractr", "readr", "tidyselect", "rsample", "jsonlite"))
```

Si el sistema compila `sf` o `terra` desde sus fuentes, también necesita las bibliotecas geoespaciales correspondientes. Para reproducción estricta utiliza las versiones registradas: el ajuste completo genera particiones internas con `rsample`, y una variación de versión puede modificar ese comportamiento. Las comprobaciones detectan diferencias frente a la referencia.

### Archivos de entrada

Se leen desde la carpeta oficial del participante, conservando esta estructura:

```text
DATASET_RETO_AGRO_2026-2/
├── ID_area_rendimiento_70_30_Reto_AgroCebada.csv
├── BASICO_AgroCebada2026.csv
├── PRO_AgroCebada.csv
├── Parcelas_Reto_AGC_CONJUNTO_70_30/
│   ├── Parcelas_Reto_AGC_CONJUNTO.shp
│   ├── Parcelas_Reto_AGC_CONJUNTO.shx
│   ├── Parcelas_Reto_AGC_CONJUNTO.dbf
│   └── Parcelas_Reto_AGC_CONJUNTO.prj
└── Reto_AgroCebada_CHIRPS_Precipitacion_2022_2025/
    └── Precipitacion_mensual/
        ├── 2022/PREC_2022_10.tif
        ├── 2023/PREC_2023_10.tif
        ├── 2024/PREC_2024_10.tif
        └── 2025/PREC_2025_10.tif
```

BASICO aporta únicamente la columna de identificadores que conserva el orden utilizado al construir particiones internas. Sus mediciones, los mapas de temperatura y los otros meses de precipitación no son necesarios para reconstruir esta receta final. No se deben sustituir archivos por datos de otra campaña.

### Comprobación rápida del artefacto guardado

```sh
Rscript modelo/comprobar_inferencia.R
```

No requiere los TIFF originales: comprueba la inferencia de las 59 entradas preparadas, la identidad del modelo y contratos de entrada. No reemplaza la reproducción completa desde datos originales.

### Ejecución por etapas

Desde la raíz del repositorio:

```sh
Rscript modelo/ejecutar_por_etapas.R "/ruta/DATASET_RETO_AGRO_2026-2" "/ruta/resultados_nuevos"
```

La carpeta de salida debe ser **nueva y no existir todavía**. El script crea esa carpeta; no debe apuntar a `modelo/resultados/` ni a la carpeta de datos originales.

El programa prepara las entradas, aprende el modelo con las 138 conocidas, genera las 59 estimaciones, comprueba su reproducción y vuelve a ejecutar las evaluaciones local, espacial y de calibración. Al completar las comprobaciones muestra `PASS`.

### Alternativa: script integrado

```sh
Rscript modelo/modelo_completo.R "/ruta/DATASET_RETO_AGRO_2026-2" "/ruta/otros_resultados_nuevos"
```

Es otra forma de ejecutar **el mismo modelo**. Conserva `contratos/` y `referencias/` junto al script. Las dos opciones producen resultados equivalentes; no es necesario ejecutar ambas para utilizar el proyecto.

### Exportar parámetros y referencias para comprobar el navegador

```sh
Rscript modelo/exportar_inferencia_app.R "/ruta/exportacion_nueva"
```

Genera `oct-g5-runtime.json` y `referencias_R.json` desde los artefactos de este repositorio. La carpeta indicada debe ser nueva. El primero coincide con el bundle de `aplicacion/src/model/`; el segundo contiene los 295 casos de `aplicacion/pruebas/`. El motor de producción carga únicamente los parámetros y entradas; el archivo de respuestas R queda fuera de `src/` y no se incluye en la compilación.

### Etapas

| Archivo en `modelo/etapas/` | Función |
| --- | --- |
| `01_leer_y_unir_datos.R` | Leer originales, unir identificadores y comprobar parcelas |
| `02_extraer_lluvia_octubre.R` | Extraer octubre 2022–2025 por cobertura de polígonos |
| `03_preparar_trayectoria_planet.R` | Filtrar, suavizar e integrar la trayectoria NDVI |
| `04_contraste_k_y_distancias.R` | Construir K y distancias entre centroides |
| `05_aprender_componente_lluvia.R` | Seleccionar representación climática y aprender ajuste territorial |
| `06_aprender_vecinos_y_correccion.R` | Aprender referencias cercanas y corrección residual |
| `07_predecir_y_exportar.R` | Calcular y exportar las 59 estimaciones |
| `08_comprobar_reproduccion.R` | Contrastar cálculo, entradas y modelo con las referencias |
| `09_validacion_fuera_de_muestra.R` | Repetir validación local, espacial y calibración |

`referencias/` contiene valores y modelos archivados **para comprobar después de calcular**. No sustituye el entrenamiento, no incorpora rendimientos ocultos y no se usa como tabla de respuestas del predictor.

## 4. Modelo final y variables

**OCT_G5 1.5.0, elección para las 59 consultas tras las comprobaciones del 18 de octubre.** Combina:

```text
J = media del grupo territorial + ajuste lineal por lluvia de octubre
MIX = 0.5 × media municipal + 0.5 × IDW20
MIX_CORR = MIX + corrección_K
Predicción = 0.5 × J + 0.5 × MIX_CORR
```

- **J:** selecciona dentro del entrenamiento entre P, H, P−H y 100(P−H)/H, mediante correlación absoluta después de centrar por grupo territorial. P es lluvia de octubre 2025 y H es la media de octubre 2022–2024. Aprende una pendiente común y niveles de cinco grupos territoriales. El ajuste completo eligió diferencia porcentual. Si no hay referencias de un grupo o municipio en un entrenamiento, utiliza las medias globales previstas en el código.
Los grupos territoriales fijos son Almoloya, Chignahuapan, Singuilucan, Tlaxcala y Otros_Hidalgo. Su mapa se incluye en `modelo/contratos/grupos_territoriales.csv`. La agrupación procede del antecedente público [netfoor, notebook 04, commit 820b173](https://github.com/netfoor/Reto-AgroCebada-FIRA-2026/tree/820b173e1d07fd54c0f388eee0ca485ac7210b54). Los coeficientes se vuelven a aprender en cada entrenamiento; eso no elimina la exposición histórica de la agrupación ni el riesgo de selección.

- **IDW20:** promedio de las 20 cosechas conocidas más cercanas del entrenamiento, con pesos `1/max(distancia_m, 1)^2`. Utiliza distancia haversine y desempate por identificador.
- **K:** integral de verdor Planet propia menos la mediana de al menos dos vecinas válidas a distancia mayor que cero y menor de 1 km. Usa las mediciones disponibles de las 197 parcelas, incluidas las consultas, sin sus rendimientos ocultos. No es la misma vecindad que IDW20.
- **Corrección_K:** regresión regularizada, sin intercepto y con penalización fija 10, sobre K estandarizado y errores de MIX obtenidos en particiones internas fuera de muestra. Con K ausente se aplica corrección cero, sin inventar valores. Ocurre en nueve de las 59 consultas.

Planet se filtra a nubosidad ≤20% y abril–octubre 2025, con mediana diaria, mediana móvil de hasta 15 días y al menos tres valores disponibles, e interpolación lineal sin extrapolar extremos. No hay un máximo impuesto al hueco interpolado. Se integra el exceso de NDVI sobre la base en el tramo delimitado por el umbral de mitad de amplitud. Los detalles y casos de ausencia están implementados en la etapa 3.

Temperatura, relieve, curva Sentinel-2 y superficie se muestran como contexto; no son entradas directas de esta ecuación. La superficie permite convertir rendimiento por hectárea en producción total aproximada. Los pesos de mezcla y los ajustes visuales no representan efectos causales ni porcentajes de importancia agronómica.

## 5. Resultados y evaluación

| Evaluación del modelo final | RMSE (t/ha) | MAE (t/ha) |
| --- | ---: | ---: |
| Local: cinco particiones, diez repeticiones | 0.474087 | 0.323841 |
| Espacial estricta: cinco particiones | 0.706840 | 0.564809 |

RMSE y MAE se ponderan por la composición municipal de las 59 consultas. El RMSE local principal es el promedio de los diez RMSE globales por repetición. La prueba espacial reúne las predicciones externas antes de calcular el error. Las repeticiones no generan nuevas parcelas independientes: siguen siendo 138 cosechas conocidas.

R² ponderado agrupado: **0.699464 local** y **0.331999 espacial**. No son porcentajes de precisión.

En 100 divisiones estratificadas 103/35 y 100 aleatorias, el RMSE fue 0.474747 y 0.473307. Frente a la versión municipal se obtuvo menor RMSE en 81 de las 100 divisiones de cada batería. La mejora principal fue de aproximadamente 0.63%; las divisiones reutilizan los mismos 138 rendimientos. La elección prioriza las 59 consultas representadas, sin afirmar superioridad universal.

Cada evaluación vuelve a aprender sus referencias, escalas, selección de lluvia y correcciones dentro del entrenamiento. Los grupos espaciales conectan parcelas por celdas climáticas compartidas y se separan completos. Los intervalos nominales del 80% se comprueban en particiones con entrenamiento, calibración y evaluación separados, midiendo cobertura y amplitud. Cobertura ponderada observada: **85.23% local y 70.87% espacial**; anchuras medias 1.229124 y 1.750185 t/ha. La menor cobertura espacial es una limitación declarada de transferencia. No se presentan como intervalos individuales certificados para el ajuste completo de las 59 consultas.

Estos resultados corresponden a una receta elegida después de explorar alternativas sobre las mismas etiquetas; no constituyen un test independiente de toda la búsqueda. El error de las 59 parcelas sigue desconocido y no se ha demostrado generalización a otros años ni pronóstico anterior a octubre.

### Comprobaciones disponibles

- [`modelo/VERIFICACION_FINAL.json`](modelo/VERIFICACION_FINAL.json): reproducción aislada de las dos formas de ejecución, 59 predicciones y correspondencia del modelo.
- [`modelo/resultados/verificacion_oof.json`](modelo/resultados/verificacion_oof.json): 55 ajustes externos, 1,518 filas de evaluación y pruebas de aislamiento de etiquetas.
- [`modelo/resultados/verificacion_calibracion.json`](modelo/resultados/verificacion_calibracion.json): reproducción de 15 particiones y 414 intervalos evaluados.
- [`modelo/resultados/validacion_metricas.csv`](modelo/resultados/validacion_metricas.csv): métricas resumidas.
- [`modelo/SHA256.json`](modelo/SHA256.json): huellas de los archivos incluidos del modelo. Refleja este paquete, sin documentación histórica retirada.

Los JSON registran comprobaciones de las corridas archivadas. El ejecutor vuelve a calcular las evaluaciones: no se limita a mostrar esos JSON.

## 6. Predicciones y objetos guardados

El CSV final está en [`modelo/resultados/predicciones_59.csv`](modelo/resultados/predicciones_59.csv), con las columnas `ID_POLIGONO` y `RENDIMIENTO_T_HA`. Coincide byte por byte con el CSV del modelo final vigente; MD5 `dc272ee3ab743c28d1350ac2381f42ee`.

En `modelo/resultados/` también se conservan:

- `modelo_oct_g5.rds`: modelo aprendido y referencias.
- `entradas_59.rds`: consultas preparadas.
- `datos_preparados.rds`: tablas y estructuras intermedias para inspección.
- `componentes_59.csv`: descomposición del cálculo.
- `metadata_197.csv`, `lluvia_197.csv`, `planet_197.csv` y `curvas_planet.csv`: preparación de covariables.
- `validacion_oof.csv`, `intervalos_validacion.csv` y `cobertura_validacion.csv`: predicciones fuera de muestra e incertidumbre evaluada.

No son las 59 cosechas reales: son resultados del modelo y datos preparados.

## 7. Cálculo e interpretación en Cebali

`aplicacion/src/model/octG5.ts` reproduce la inferencia con los parámetros y referencias de `oct-g5-runtime.json`, cargados al solicitar el cálculo. Este archivo de ejecución contiene las 138 referencias y las 59 entradas; no las respuestas finales de estas últimas. El catálogo visual conserva resultados de referencia por separado. La base mostrada combina por mitades la media territorial y la media municipal; lluvia, proximidad y K se descomponen respecto a esa base, y su suma reproduce la estimación. No se presenta esa base como una media municipal pura.

La portabilidad a TypeScript se comprobó contra R en 295 casos: las 59 consultas originales y variantes de datos ausentes o lluvia modificada. Todas las diferencias quedaron por debajo de la tolerancia absoluta de 10⁻¹² t/ha. Esta equivalencia del cálculo no mide exactitud frente a los rendimientos ocultos.

**Explora tu estimación** modifica únicamente lluvia de octubre dentro del rango municipal preparado. Mantiene las demás entradas y ejecuta la misma ecuación; no altera la estimación original, el CSV o la ficha PDF. Representa sensibilidad del cálculo, no el efecto causal de modificar la lluvia ni otra campaña. No se habilita sin referencias suficientes.

La ficha PDF se genera en el navegador. Las 138 observadas conservan el dato oficial; para las 59 requiere un resultado recién calculado del mismo identificador. La aplicación muestra advertencias de soporte para AGC_120 y AGC_174, sin cambiar sus estimaciones.

## 8. Estilos y recursos visuales

`aplicacion/src/index.css` reúne `src/styles/`. Colores, radios y tiempos compartidos están en `tokens.css`. Los controles reutilizables son `Button`, `Stat`, `Disclosure` y `ChoiceSelect` en `src/components/ui/`; las pantallas mantienen sus estilos específicos por función. Los selectores abren un diálogo redondeado con opciones grandes, búsqueda en listas largas, cierre con Escape y navegación mediante flechas. Se reutiliza la misma plantilla para estados, municipios, parcelas y comparaciones.

La bienvenida presenta la mascota con una animación de marca de 2.55 segundos, sin simular una carga del modelo. Se puede omitir con el botón de entrada o Escape; se muestra una vez por pestaña y sesión y se omite al abrir directamente una pantalla o cuando se solicita movimiento reducido. La interfaz se prepara al mismo tiempo. `welcome.css`, `choices.css`, `motion.css` y el visor respetan la preferencia de movimiento reducido.

Antes de descargar el código inicial, el HTML muestra una portada ligera. Si falla la descarga o la conexión tarda, ofrece volver a cargar. Los gráficos también presentan una acción de recuperación si no se descargan. Las imágenes satelitales son opcionales: sin ellas se conservan los contornos y la selección de parcelas.

La lista de revisión abre directamente estimaciones ya calculadas por el motor. Al regresar se conservan la parcela de procedencia, el alcance municipal o estatal y la lista completa, sin repetir el cálculo. Las cifras se guardan solo en memoria durante la visita.

El mapa y las cabeceras usan contornos del SHP oficial en EPSG:32614 y nueve recortes municipales reales Sentinel-2 L2A del **27 de octubre de 2025**, a **10 m/píxel**. Conservan posiciones, orientación y escala del terreno. Las 51 zonas de navegación no son grupos estadísticos del modelo. Los colores distinguen selección y contexto, no salud del cultivo.

Contiene datos Copernicus Sentinel modificados, 2025, obtenidos del [archivo abierto Sentinel-2 L2A / Earth Search](https://registry.opendata.aws/sentinel-2-l2a-cogs/), escenas `S2B_14QNG_20251027_0_L2A` y `S2B_14QNH_20251027_0_L2A`, consultadas el 17 de octubre de 2026. La procedencia y georreferenciación constan en `aplicacion/src/data/parcel-imagery.json`. La captura es referencia visual, no nueva entrada del modelo. Los recursos se sirven localmente, sin API ni teselas externas.

Las fuentes Nunito están incluidas localmente, al igual que el marco del teléfono y las ilustraciones utilizadas por la interfaz. Se retiraron los recursos del scaffolding que ya no se utilizan.

La mascota de bienvenida `aplicacion/public/cebali-mascot.webp` se generó con asistencia de IA a partir de la referencia visual del proyecto. Es una ilustración decorativa con transparencia, optimizada para la web; no representa datos de una parcela ni interviene en las estimaciones.

## 9. Documentación complementaria de la entrega

Las bases solicitan identificar el uso de inteligencia artificial e incluir sus prompts en el escrito, además de las aportaciones de cada integrante en anexos. Hubo apoyo de IA en programación, exploración, revisión y documentación; su declaración y los prompts utilizados deben acompañar el informe técnico, sin sustituir la revisión del equipo.

Este repositorio se mantiene privado para revisión del equipo. Antes de entregar, el código y la aplicación deben quedar accesibles al jurado mediante el mecanismo elegido. Publicar código no sustituye el envío del informe, bibliografía, anexos, video y CSV por los medios indicados por el Comité Organizador.

## 10. Integridad y alcance de la carpeta

La revisión contiene una sola receta: OCT_G5 1.5.0. No hay scripts de selección de candidatos ni dependencias del workspace de investigación. Los archivos de `referencias/` y los casos R verifican el resultado después del cálculo. Los TIFF originales se indican mediante el argumento de ejecución y no se redistribuyen.

`modelo/COMPROBACION_PAQUETE.json` registra la revisión de rutas, artefactos y correspondencia con el navegador. `modelo/SHA256.json` identifica los archivos del modelo. Las rutas de la corrida archivada están expresadas como `DATOS/` y `modelo/`; no se requiere esa ruta literal para ejecutar: el argumento del comando decide dónde leer los datos.

La investigación previa y la exposición de la agrupación territorial se declaran como limitaciones metodológicas, no se borran del relato. El historial Git conserva las revisiones anteriores, aunque no forman parte del árbol de archivos actual.
