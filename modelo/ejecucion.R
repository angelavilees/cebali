# Coordinacion de las nueve etapas. No se instalan paquetes ni se sobreescriben salidas.
ejecutar_modelo <- function(carpeta_datos, salida, carpeta_paquete) {
  stopifnot(dir.exists(carpeta_datos), !file.exists(salida))
  dir.create(salida, recursive = TRUE)
  message("1/9 Unir registros y poligonos oficiales")
  d <- leer_y_unir_datos(carpeta_datos, carpeta_paquete)
  message("2/9 Extraer octubre 2022-2025")
  d <- extraer_lluvia_octubre(d)
  message("3/9 Preparar trayectoria Planet")
  d <- preparar_trayectoria_planet(d)
  message("4/9 Construir contraste K y distancias")
  d <- contraste_k_y_distancias(d)
  message("5-6/9 Aprender lluvia, vecinos y correccion con las 138 conocidas")
  ajuste <- aprender_modelo(d)
  message("7/9 Estimar las 59 consultas")
  registro <- preparar_consultas(d)
  resultado <- predecir_modelo(ajuste$modelo, registro, registro)
  message("8/9 Comprobar equivalencia con el modelo vigente")
  verificacion <- comprobar_reproduccion(d, ajuste, resultado, carpeta_paquete)
  message("9/9 Reproducir validacion local y espacial")
  metricas <- validacion_fuera_de_muestra(d, carpeta_paquete, salida)
  cobertura <- calibrar_intervalos(d, carpeta_paquete, salida)
  exportar_resultados(d, ajuste, resultado, salida)
  # Estos contratos contienen posiciones/roles; no rendimientos ni predicciones.
  contratos <- list.files(file.path(carpeta_paquete, "contratos"), full.names = TRUE)
  fuentes <- c(d$fuentes, contratos)
  write.csv(data.frame(archivo = fuentes, MD5 = unname(tools::md5sum(fuentes))),
             file.path(salida, "huellas_entradas.csv"), row.names = FALSE)
  jsonlite::write_json(verificacion, file.path(salida, "verificacion.json"),
                       auto_unbox = TRUE, pretty = TRUE, digits = 16)
  writeLines(capture.output(sessionInfo()), file.path(salida, "sessionInfo.txt"))
  print(metricas)
  print(cobertura)
  message("PASS: 59 predicciones reproducidas. Resultados: ", normalizePath(salida))
  invisible(list(datos = d, ajuste = ajuste, predicciones = resultado,
                 metricas = metricas, cobertura = cobertura))
}
