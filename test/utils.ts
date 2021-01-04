const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')

export const getGRPCClient = (url: string) => {
  const PROTO_PATH = process.cwd() + '/src/protos/api.proto'


  const packageDefinition = protoLoader.loadSync(
      PROTO_PATH,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      })
  const api_proto = grpc.loadPackageDefinition(packageDefinition).communicationsapi

  return new api_proto.CommunicationsApi(url, grpc.credentials.createInsecure())
}

export const promisifyCall = (call: Function): Promise<any> => {
  return new Promise((resolve, reject) => {
    call((err: any, response: any) => {
      if (err) {
        reject(err)
      }
      resolve(response)
    })
  })
}
