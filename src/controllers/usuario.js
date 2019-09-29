/**
 * Diretório - ./src/controllers/usuario.js
 */

const database = require("../models/database")()
const jwt = require("jsonwebtoken")
const authConfig = require("../../libs/auth")
const bcrypt = require("bcrypt")
const nodemailer = require('nodemailer')

function geraToken(params = {}){
    return jwt.sign(params , authConfig.secret, {
        expiresIn: 86400
    })
}

function envia_email(destinatario, token, nome){
    const transporter = nodemailer.createTransport({                                            
        host: "smtp.gmail.com",
        service: "gmail",
        port:  587,
        secure: false,

        auth: {
            user: "wedo.suporte@gmail.com",
            pass: "tcc2019wedo"
        },
        tls: { rejectUnauthorized: false }
      })
      let msg = "Saudações, "+nome+"! \n \n Obrigado por se registrar na plataforma We Do! \n \n \n Clique em http://127.0.0.1:5500/index.html?token=" + token + " para se autenticar e trocar ideias com outras pessoas! \n \n Caso você não tenha se cadastrado em nossa plataforma, apenas ignore este email! \n \n Obrigado pela compreensão.\n Atenciosamente \n Equipe We Do."

      const mailOptions = {
        from: "wedo.suporte@gmail.com",
        to: destinatario,
        subject: 'Verificação de email - We Do',
        text: msg
      }

      transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return error
        }else{ 
            return info
        }
      });
}  

exports.valida_conta = (req, res) => {
    let token = req.body.token     
    jwt.verify(token, authConfig.secret, (err, decoded) => {
        if(err){
            res.status(203).send({err: err}).end()
        }else{
            let id_usuario = decoded.id                     
            database.query("UPDATE tb_usuario SET status_usuario = 1 WHERE id_usuario = ?;", id_usuario, (err, rows, fields) => {
                if(err){
                    return res.status(200).send({err: err}).end()
                }else{
                    return res.status(200).send({msg: "Conta confirmada com sucesso!"}).end()
                }
            })
        }
    })
                            
        
    
}

 /**
 * Realiza o cadastro do usuário
 * 
 * @param void
 * 
 * @body 
 *  usuario : {
 *     email_usuario: "email",
 *     senha_usuario: "senha",
 *     nm_usuario : "nome",
 *     dt_nascimento: "data de nascimento",
 *     tecnologias_usuario: [
 *         1, 
 *         2, 
 *         3, 
 *         5, 
 *         7
 *     ]   
 * }
 * 
 * @return JSON {msg} / {err}
 */
exports.cadastro = (req, res) => {   
    // Verificação se já existe o email que se quer cadastrar
    database.query("SELECT * FROM tb_usuario WHERE email_usuario = '" + req.body.usuario.email_usuario + "'", (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: err}).end()
        }else{
            if(rows.length == []){             
                bcrypt.hash(req.body.usuario.senha_usuario, 10, (err, hash) => {
                    //cadastra primeiro o usuario
                    if(err){
                        return res.send({err: "Erro ao tentar criptografar senha"}).end()
                    }else{
                        let dados_usuario = [  
                            "default", 
                            "'" + req.body.usuario.email_usuario + "'", 
                            "'" + hash + "'", 
                            "'" + req.body.usuario.nm_usuario + "'",
                            "'" + req.body.usuario.dt_nascimento + "'",
                            "null",
                            "null",
                            "curdate()",
                            0
                        ]
    
                        database.query("INSERT INTO tb_usuario VALUES (" + dados_usuario + ")", (err2, rows2, fields2) => {
                            if(err2){
                                return res.status(200).send({err: err}).end()
                            }else{
                                // Cadastro OK
                                // Liga as tecnologias com o usuario
                                // Guarda todas as tecnologias em uma variavel
                                let count = 0
                                let insert = ""
                                while (count < req.body.usuario.tecnologias_usuario.length){
                                    if(count == req.body.usuario.tecnologias_usuario.length - 1) // req.body.usuario.tecnologias_usuario[count] 
                                        insert += "(" + req.body.usuario.tecnologias_usuario[count]  + ", " + rows2.insertId + ") "
                                    else
                                        insert += "(" + req.body.usuario.tecnologias_usuario[count]  + ", " + rows2.insertId + "), "  
    
                                    count++
                                }                        
    
                                database.query("INSERT INTO tecnologia_usuario VALUES " + insert, (err3, rows3, fields3) => {
                                    if(err3){
                                        return res.status(200).send({err: "Não foi possível cadastrar as tecnologias"}).end()
                                    }else{
                                        //Enviar email  
                                        /**
                                         * ----------------------Arrumar
                                         */
                                        
                                        database.query("INSERT INTO tb_notificacao VALUES (?, 0, 0);", [rows2.insertId], (err4, rows4, fields4) => {
                                            if(err4){
                                                return res.status(200).send({err: err4}).end()
                                            }else{
                                                let newToken = geraToken({id: rows2.insertId})
                                                let send = envia_email(req.body.usuario.email_usuario, newToken, req.body.usuario.nm_usuario)
                                                return res.status(200).send({msg: "Email enviado! Favor confirmar endereço de email!"}).end()
                                            }
                                        }) 
                                    }
                                })
                            }
                        })
                    }                               
                });      
            }else{
                return res.status(200).send({err: "Este email já está em uso"}).end()
            }
        }
    })
}

/**
 * Realiza o login do usuário
 * 
 * @param void
 * 
 * @body
 * "usuario": {
 *      "email_usuario": "<Email do usuario>"
 *      "senha_usuario": "<Senha do usuario>"
 *  }
 * 
 * @return JSON {usuario, token} / {err}
 */
exports.login = (req, res) => {    
    // Verifica se o email ta certo, senha está certo e se o usuario está apto para logar (status == 1)
    database.query("SELECT * FROM tb_usuario WHERE email_usuario = '" + req.body.usuario.email_usuario + "'", (err, rows, fields) => {
        
        if(rows.length != []){
            if(req.body.usuario.email_usuario == rows[0].email_usuario){
                // Verifica a senha
                let password = req.body.usuario.senha_usuario
                bcrypt.compare(password, rows[0].senha_usuario)
                    .then((result) => {                        
                        if(!result){
                            return res.status(200).send({err: "Senha incorreta! Por favor, tente novamente"}).end()
                        }else{    
                            if(rows[0].status_usuario == 0){
                                return res.status(200).send({err: "Você precisa verificar seu email!"}).end()
                            }else{
                                database.query("SELECT id_ultima_curtida, id_ultimo_comentario FROM tb_notificacao WHERE id_usuario = ?", [rows[0].id_usuario], (err2, rows2, fields2) => {
                                    if(err2){
                                        return res.status(200).send({err: err2}).end()
                                    }else{
                                        //Loga
                                        let newToken = "Bearer " + geraToken({"id": rows[0].id_usuario})
                                            
                                        return res.status(200).send({
                                            usuario: {
                                                id_usuario : rows[0].id_usuario,
                                                nm_usuario : rows[0].nm_usuario,
                                                id_ultima_curtida : rows2[0].id_ultima_curtida,
                                                id_ultimo_comentario : rows2[0].id_ultimo_comentario
                                            },
                                            token: newToken
                                        }).end() 
                                    }
                                }) 
                            }                                                                                  
                        }                                              
                });            
            }else{
                return res.status(200).send({err: "Usuario não encontrado"}).end()
            }
        }else{
            return res.status(200).send({err: "Usuario não encontrado"}).end()
        }
        
    })
}


/**
 *  Recuperação de senha
 *  Manda email para confirmar alteração de senha no site web
 *  
 * @param void
 * 
 * @body 
 * usuario: {
 *      "email_usuario": "<email do usuario>"
 * }
 * 
 * @return link para troca de email
 */
exports.recupera_senha = (req, res) => {
    
    let email = req.body.usuario.email_usuario
    database.query("SELECT id_usuario FROM tb_usuario WHERE email_usuario = ?", email, (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: "Erro de busca no email"}).end()
        }else{
            if(rows == []){
                return res.status(200).send({err: "Email não registrado"}).end()
            }else{
                // envia email                
                let token = geraToken({id: rows[0].id_usuario})
                return res.send("https://wedo.com.br/troca_senha/" + token).end()
            }
        }
    })
}

/**
 * Faz a troca exclusivamente da senha
 * 
 * @param id_usuario
 * 
 * @body 
 * "usuario": {
 *      "senha_usuario": "<Nova senha do usuário>"
 * }
 * 
 * @return JSON{msg, token} / {err}
 */
exports.troca_senha = (req, res) => {

    bcrypt.hash(req.body.usuario.senha_usuario, 10, (err, hash) => {
        if(err){
            return res.status(200).send({err: err}).end()
        }else{  
            database.query("UPDATE tb_usuario SET senha_usuario = ? WHERE id_usuario = ?", [hash, req.params.id_usuario], (err2, rows, fields) => {
                if(err2){
                    return res.status(200).send({err: "Erro de update"}).end()
                }else{
                    // Gera token
                    let newToken = geraToken({"id": req.params.id_usuario})
                    return res.status(200).send({
                        msg: "Ok",
                        token: newToken    
                    }).end()
                }
            })
        }
    })  
}

/**
 * Atualiza os dados do usuário (usado em qualquer alteração)
 * 
 * @param id_usuario
 * 
 * @body {usuario}
 * 
 * @return JSON {msg} / {err}
 * 
 */
exports.atualiza_dados = (req, res) => {
    database.query("UPDATE tb_usuario SET ? WHERE id_usuario = ? ", [req.body.usuario, req.params.id_usuario], (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: err}).end()
        }else{
            return res.status(200).send({msg: "Ok"}).end()
        }
    })
}

/**
 * Usuário denunciar outro usuário
 * 
 * @param void
 * 
 * @body
 * "denuncia": {
 *      "descricao_denuncia": "descricao",
 *      "id_usuario_acusador": id,
 *      "id_usuario_denunciado": id
 * }
 * 
 * @return JSON {msg} / {err}
 */

exports.denuncia = (req, res) => {
    let desc = req.body.denuncia.descricao_denuncia
    let acusador = req.body.denuncia.id_usuario_acusador
    let denunciado = req.body.denuncia.id_usuario_denunciado

    
    // Saber se ja teve denuncia

    database.query("SELECT * FROM tb_denuncia WHERE id_usuario_acusador = ? AND id_usuario_denunciado = ?", [acusador, denunciado], (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: "Erro na busca das denuncias"}).end()
        }else{
            if(rows.length == []){
                // Efetua a denuncia                 
                database.query("INSERT INTO tb_denuncia (desc_denuncia, id_usuario_acusador, id_usuario_denunciado) VALUES (?, ?, ?)", [desc, acusador, denunciado], (err2, rows2, fields2) => {
                    if(err2){
                        return res.status(200).send({err: err2}).end()
                    }else{
                        return res.status(200).send({msg: "Ok"}).end()
                    }
                })
            }else{
                // Retira a denuncia
                database.query("DELETE FROM tb_denuncia WHERE id_usuario_acusador = ? AND id_usuario_denunciado = ?", [acusador, denunciado], (err3, rows3, fields3) => {
                    if(err3){
                        return res.status(200).send({err: "Erro na retirada da denuncia"}).end()
                    }else{
                        return res.status(200).send({msg: "Ok"}).end()
                    }
                })
            }
        }
    })

}

/** 
 * Mostra os dados de um usuário pesquisado
 * 
 * @param void
 * 
 * @body
 * "usuario": {
 *      "id_usuario_pesquisado": id,
 *      "id_usuario": id
 * }
 * 
 * @return JSON {perfil_usuario, token} / {err}
*/
exports.busca_perfil = (req, res) => {    
    database.query("SELECT id_usuario, nm_usuario, email_usuario, ds_bio, tel_usuario FROM tb_usuario WHERE id_usuario = ?", req.body.usuario.id_usuario_pesquisado, (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: "Erro na busca do perfil solicitado"}).end()
        }else{
            let newToken = geraToken({"id": req.body.usuario.id_usuario})
            return res.status(200).send({
                perfil_usuario : {
                    rows
                },
                token: newToken
            }).end()
        }
    })
}

/** 
 * Mostra os dados do usuário
 * 
 * @param id_usuario
 * 
 * @body void
 * 
 * @return JSON {perfil_usuario, token} / {err}
*/
exports.perfil = (req, res) => {
    
    database.query("SELECT id_usuario, nm_usuario, email_usuario, ds_bio, tel_usuario FROM tb_usuario WHERE id_usuario = ?", req.params.id_usuario, (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: "Erro na busca do perfil solicitado"}).end()
        }else{
            let newToken = geraToken({"id": req.params.id_usuario})
            return res.status(200).send({
                "perfil_usuario": rows,
                token: newToken
            }).end()
        }
    })
}

/**
 * Deleta o usuário
 * 
 * @param void
 * 
 * @body 
 * "usuario": {
 *      "id_usuario": id
 * }
 * 
 * @return JSON {msg} / {err}
 */
exports.deleta = (req, res) => {
    let id = req.body.usuario.id_usuario

    database.query("CALL spDeleta_usuario(?);", [id], (err, rows, fields) => {
        if(err){
            return res.status(200).send({err: err}).end()
        }else{
            return res.status(200).send({msg: 'Ok'}).end()
        }
    })
}